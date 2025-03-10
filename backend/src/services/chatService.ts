/**
 * Chat Service (ChatService)
 * 
 * Responsibility division:
 * - ChatService: Responsible for chat logic processing and AI interaction, including WebSocket communication, message processing, and tool calls
 * - SessionService: Responsible for session data storage and management, including session creation, query, update, and deletion operations
 * 
 * This separation ensures the single responsibility principle, eliminates code duplication, and improves system maintainability.
 */

import { ChatMessage, ChatRequest, ChatRole, Message, ChatCompletionTool, ChatSession } from '../types/chat';
import { SessionService } from './sessionService';
import { TextContent, ImageContent, EmbeddedResource } from '../types/mcp';
import { mcpManager } from './mcpService';
import { mcpConfig } from '../config/mcpConfig';
import { LLMService } from './llmService';
import { env } from '../config/env'
import WebSocket from 'ws';

/**
 * Chat Service
 * Responsible for handling chat logic and AI interaction
 * Note: Session storage and management is handled by SessionService
 */
export class ChatService {
  // Remove internal session storage, use SessionService instead
  private static llmService = new LLMService();

  /**
   * Get the model name to use
   * @private
   */
  private static getModelName(): string {
    // Get model name from environment variable, or use default if not set
    return env.OPENROUTER_MODEL;
  }

  /**
   * Get MCP tool definitions in LLM-compatible format
   */
  private static getMCPToolDefinitions(): ChatCompletionTool[] {
    try {
      const tools: ChatCompletionTool[] = [];
      const servers = mcpConfig.servers;

      for (const server of servers) {
        const serverTools = mcpManager.getServerTools(server.name);

        for (const tool of serverTools) {
          // Build LLM tool format
          const parameters = tool.inputSchema || {};

          if (!parameters.type) {
            parameters.type = 'object';
          }

          if (parameters.type === 'object' && !parameters.properties) {
            parameters.properties = {};
          }

          tools.push({
            type: 'function' as const,
            function: {
              name: `${server.name}__${tool.name}`,
              description: tool.description,
              parameters: parameters
            }
          });
        }
      }

      return tools;
    } catch (error) {
      console.error(`Failed to get MCP tool definitions:`, error);
      return [];
    }
  }

  /**
   * Stream process chat request, providing real-time updates via WebSocket
   * @param request Chat request
   * @param socket WebSocket connection
   * @param session Session object, provided by WebSocket connection handler
   * @returns Session ID
   */
  static async streamChat(request: ChatRequest, socket: WebSocket, session: ChatSession, privyUserId: string): Promise<string> {
    console.log('\n============== Project-LLM Interaction Log ==============');
    const { sessionId, message, enableTools } = request;

    // Save original sessionId from frontend for returning to client
    const originalSessionId = sessionId;

    // Send initial thinking message
    this.sendSocketMessage(socket, {
      type: 'thinking',
      content: 'I am thinking ...'
    });

    // Get session history messages
    const history = session.messages;

    // Build LLM messages
    const llmMessages: Message[] = [];

    // Add system message (if any)
    const systemMessage = history.find(msg => msg.role === ChatRole.SYSTEM);
    if (systemMessage) {
      llmMessages.push({
        role: 'system',
        content: systemMessage.content + `\n\nYou Privy userId is: ${privyUserId}`
      });
    }

    // Add history messages (excluding system message)
    const historyMessages = history.filter(msg => msg.role !== ChatRole.SYSTEM);
    
    // Only log historyMessages in development environment
    if (env.NODE_ENV === 'development') {
      console.log('historyMessages', historyMessages);
    }

    // Ensure all history messages have correct session ID
    for (const msg of historyMessages) {
      // If message has no session ID or session ID doesn't match, add warning log
      if (!msg.sessionId) {
        console.warn(`[Warning] History message has no session ID, automatically set to current session ID: ${session.id}`);
        msg.sessionId = session.id;
      } else if (msg.sessionId !== session.id) {
        console.warn(`[Warning] History message session ID(${msg.sessionId}) doesn't match current session ID(${session.id}), may cause message confusion`);
      }

      // Only add messages belonging to current session to LLM message list
      if (msg.sessionId === session.id) {
        llmMessages.push({
          role: msg.role === ChatRole.USER ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: ChatRole.USER,
      content: message,
      timestamp: new Date(),
      sessionId: session.id
    };

    // Add user message to session
    await SessionService.addMessage(session.id, userMessage);

    llmMessages.push({
      role: 'user',
      content: message
    });

    let assistantContent = '';
    let assistantMessage: ChatMessage;

    try {
      // Prepare request parameters
      const requestOptions: any = {
        model: this.getModelName(),
        messages: llmMessages,
        temperature: 0.7
      };

      // If tools are enabled, add tool definitions
      if (enableTools) {
        const mcpTools = this.getMCPToolDefinitions();
        if (mcpTools.length > 0) {
          requestOptions.tools = mcpTools;
          requestOptions.tool_choice = 'auto';
        }
      }

      let currentMessages = [...llmMessages];
      let continueProcessing = true;
      let toolCallRounds = 0;
      let remediationAttempts = 0;
      const MAX_TOOL_CALL_ROUNDS = 10;
      const MAX_REMEDIATION_ATTEMPTS = 2;

      while (continueProcessing && toolCallRounds < MAX_TOOL_CALL_ROUNDS) {
        // Record start time for LLM request
        const requestStartTime = Date.now();
        
        // Send request (no need for initial separate request)
        const currentResponse = await this.llmService.sendChatRequest({
          model: this.getModelName(),
          messages: currentMessages,
          temperature: 0.7,
          tools: requestOptions.tools,
          tool_choice: 'auto'
        });
        
        // Calculate and log time taken
        const requestEndTime = Date.now();
        const requestDuration = requestEndTime - requestStartTime;
        console.log(`[LLM Timing] Tool call round ${toolCallRounds} completed in ${requestDuration}ms`);

        // Ensure currentResponse is not null
        if (!currentResponse) {
          console.error('Error: currentResponse is null');
          break;
        }

        // Get message from current response
        const currentResponseMessage = currentResponse.choices[0].message;

        // Always send text content (if any), even if tool calls exist
        if (currentResponseMessage.content) {
          console.log('[asistant message] currentResponseMessage', currentResponseMessage.content);
          
          // Pattern detection for problematic messages
          let messageContent = currentResponseMessage.content;
          const jsonPattern = /"type":"text"/;
          
          
          // Other problematic patterns - detect claims about tool usage
          const fakeToolPattern = /(I've|I have|I just|I've just|I successfully) (created|generated|made|executed|used|called|completed|processed) (a |the )?(transaction|tool call|function)/i;
          
          // Add pattern to catch "transaction is ready" claims
          const fakeTransactionReadyPattern = /transaction is ready/i;
          
          // Check for JSON pattern or fake tool claims (with no actual tool calls)
          const hasJsonPattern = jsonPattern.test(messageContent);
          
          // Check if problematic pattern exists and handle retries (max 2)
          if ((hasJsonPattern) && remediationAttempts < MAX_REMEDIATION_ATTEMPTS) {
            remediationAttempts++;
            console.log(`[Pattern Detection] Found problematic pattern in assistant message: ${messageContent}. Remediation attempt ${remediationAttempts}/${MAX_REMEDIATION_ATTEMPTS}`);
            
            // Add reminder message about important rules
            const reminderMessage: Message = {
              role: ChatRole.USER,
              content: `REMINDER OF CRITICAL RULES:
1. NEVER provide fake data or pretend to use tools
2. NEVER post raw JSON strings in your response
3. NEVER claim to have created a transaction or called a function when you haven't
4. DO NOT pretend to have performed actions or used tools when you haven't actually done so
5. REMEMBER that all tool usage must be explicit through proper tool_calls

Please reformulate your last response following these rules.`
            };
            
            // Add reminder to messages but DON'T increment toolCallRounds
            currentMessages.push(reminderMessage);
            
            // Skip the rest of this iteration to retry with the reminder
            continue;
          }

          remediationAttempts = 0;
          
          // Send the message if it's valid or we've exhausted retries
          this.sendSocketMessage(socket, {
            type: 'assistant_message',
            content: messageContent
          });

          // Accumulate assistant content for final storage
          if (!assistantContent) {
            assistantContent = messageContent;
          } else {
            assistantContent += "\n\n" + messageContent;
          }

          // Immediately store this assistant message to database
          const assistantPartialMessage: ChatMessage = {
            role: ChatRole.ASSISTANT,
            content: messageContent,
            timestamp: new Date(),
            sessionId: session.id,
            toolCallId: currentResponseMessage.tool_calls?.[0]?.id,
            toolName: currentResponseMessage.tool_calls?.[0]?.function?.name
          };

          await SessionService.addMessage(session.id, assistantPartialMessage);
        }

        // If no tool calls or all tool calls have been processed, processing ends
        if (!currentResponseMessage.tool_calls ||
          currentResponseMessage.tool_calls.length === 0 ||
          toolCallRounds === MAX_TOOL_CALL_ROUNDS - 1) {

          // Terminate loop
          continueProcessing = false;
          break;
        }

        // Add current response to message list
        currentMessages.push(currentResponseMessage);
        console.log('currentResponseMessage', currentResponseMessage);

        // Process all tool calls
        for (const toolCall of currentResponseMessage.tool_calls) {
          if (toolCall.type !== 'function') {
            continue;
          }

          const toolName = toolCall.function.name;
          console.log(`\n[Tool Call] ${toolName}`);

          let toolArgs: Record<string, any> = {};

          try {
            toolArgs = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;

            console.log('toolArgs', toolArgs);

            let content = `I need to use ${toolName} to deal with it...`
            if (toolName.includes(`transaction_sign`)) {
              content = `Here is the transaction info:`
            }

            // Inform user about tool call
            this.sendSocketMessage(socket, {
              type: 'tool_calling',
              content: content,
              tool: {
                name: toolName,
                args: toolArgs
              }
            });

            // Execute tool call
            const result = await mcpManager.callTool(toolName, toolArgs);
            console.log('result', result);
            // Extract content from result
            let resultContent = '';
            if (result.content && result.content.length > 0) {
              // Iterate through all content items
              for (const contentItem of result.content) {
                // Process content based on type
                const itemType = contentItem.type || 'unknown';

                if (itemType === 'text') {
                  // Process text content
                  const textContent = (contentItem as TextContent).text;
                  resultContent += textContent;
                } else if (itemType === 'image') {
                  // Process image content
                  const imageContent = contentItem as ImageContent;
                  const imageInfo = `[Image: MIME type ${imageContent.mimeType}, base64 data length: ${imageContent.data.length}]`;
                  resultContent += imageInfo;
                } else if (itemType === 'embedded_resource') {
                  // Process embedded resource
                  const resourceContent = contentItem as EmbeddedResource;
                  const resourceInfo = `[Embedded Resource: ${JSON.stringify(resourceContent.resource)}]`;
                  resultContent += resourceInfo;
                }
              }
            }

            // Log tool call result
            console.log(`[Tool Result] ${resultContent.substring(0, 500)}${resultContent.length > 500 ? '...' : ''}`);

            // Send indication of tool result
            this.sendSocketMessage(socket, {
              type: 'thinking',
              content: `I have obtained data from the tool`
            });

            // Add tool result to message list
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: resultContent
            });

            // Save tool message to database
            const toolMessage: ChatMessage = {
              role: ChatRole.TOOL,
              content: resultContent,
              timestamp: new Date(),
              sessionId: session.id,
              toolCallId: toolCall.id,
              toolName: toolName
            };
            await SessionService.addMessage(session.id, toolMessage);

          } catch (error) {
            console.error(`[Tool Error] ${error}`);
            const errorMessage = `Tool call failed: ${error instanceof Error ? error.message : String(error)}`;

            // Inform user about tool call failure
            this.sendSocketMessage(socket, {
              type: 'tool_error',
              content: `Tool ${toolName} call failed: ${errorMessage}`
            });

            // Add error result to message list
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: errorMessage
            });

            // Save error tool message to database
            const errorToolMessage: ChatMessage = {
              role: ChatRole.TOOL,
              content: errorMessage,
              timestamp: new Date(),
              sessionId: session.id,
              toolCallId: toolCall.id,
              toolName: toolName
            };
            await SessionService.addMessage(session.id, errorToolMessage);
          }
        }

        // Increase tool call round count
        toolCallRounds++;
      }

      // If maximum rounds reached but there are still unfinished tool calls, send final summary request
      if (toolCallRounds >= MAX_TOOL_CALL_ROUNDS && continueProcessing) {
        console.log(`\n[Reached tool call limit] Request summary answer`);

        // Add summary request
        currentMessages.push({
          role: 'user',
          content: 'Please provide a complete summary answer based on all information up to this point.'
        });

        const finalResponse = await this.llmService.sendChatRequest({
          model: this.getModelName(),
          messages: currentMessages,
          temperature: 0.7
        });

        // Process summary response
        const finalSummaryMessage = finalResponse.choices[0].message;
        if (finalSummaryMessage.content) {
          // Send summary message to client
          this.sendSocketMessage(socket, {
            type: 'assistant_message',
            content: finalSummaryMessage.content
          });

          assistantContent = finalSummaryMessage.content;

          // Immediately store summary message to database
          const assistantSummaryMessage: ChatMessage = {
            role: ChatRole.ASSISTANT,
            content: finalSummaryMessage.content,
            timestamp: new Date(),
            sessionId: session.id
          };


          await SessionService.addMessage(session.id, assistantSummaryMessage);
        }
      }
    } catch (error) {
      console.error('[Error] Failed to process chat request:', error);
      const errorMessage = `Sorry, there was a problem processing your request: ${error instanceof Error ? error.message : String(error)}`;

      // Send error information
      this.sendSocketMessage(socket, {
        type: 'error',
        content: errorMessage
      });

      assistantContent = errorMessage;

      // Immediately store error message to database
      const errorAssistantMessage: ChatMessage = {
        role: ChatRole.ASSISTANT,
        content: errorMessage,
        timestamp: new Date(),
        sessionId: session.id
      };
      await SessionService.addMessage(session.id, errorAssistantMessage);
    }

    // Send completion signal - use original sessionId from frontend
    this.sendSocketMessage(socket, {
      type: 'complete',
      sessionId: originalSessionId
    });

    console.log('\n============== Interaction Log Ends ==============\n');

    return session.id;
  }

  /**
   * Send WebSocket message
   * @private
   */
  private static sendSocketMessage(socket: WebSocket, message: any): void {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket connection is closed, cannot send message');
    }
  }
} 