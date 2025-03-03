/**
 * 聊天服务 (ChatService)
 * 
 * 职责划分:
 * - ChatService: 负责聊天逻辑处理和AI交互，包括WebSocket通信、消息处理和工具调用等
 * - SessionService: 负责会话数据的存储和管理，包括会话创建、查询、更新和删除等操作
 * 
 * 这种分离确保了单一职责原则，消除了代码重复，并提高了系统的可维护性。
 */

import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatMessage, ChatRequest, AppChatResponse, ChatRole, Message, ToolCall, ChatCompletionTool, ChatSession } from '../types/chat';
import { llm } from './llm';
import { SessionService } from './session';
import { v4 as uuidv4 } from 'uuid';
import { TextContent, ImageContent, EmbeddedResource } from '../types/mcp';
import { mcpManager } from './mcpService';
import { mcpConfig } from '../config/mcpConfig';
import { LLMService } from './llmService';
import WebSocket from 'ws';
import { getSystemPrompt } from '../config/prompts';

/**
 * 聊天服务
 * 负责处理聊天逻辑和AI交互
 * 注意：会话存储和管理由SessionService负责
 */
export class ChatService {
  // 移除内部会话存储，改用SessionService
  private static llmService = new LLMService();

  /**
   * 获取要使用的模型名称
   * @private
   */
  private static getModelName(): string {
    // 从环境变量获取模型名称，如果未设置则使用默认值
    return process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  }

  /**
   * 根据消息内容选择合适的MCP服务器
   * @private
   */
  private static getServerForQuery(message: string): string {
    // 获取可用服务器列表
    const availableServers = mcpConfig.servers.map(server => server.name);
    
    if (availableServers.length === 0) {
      console.warn('没有配置可用的MCP服务器');
      return mcpConfig.settings.defaultServer;
    }
    
    // 检查默认服务器是否存在于可用服务器列表
    const defaultServer = mcpConfig.settings.defaultServer;
    if (!availableServers.includes(defaultServer)) {
      console.warn(`默认服务器 "${defaultServer}" 不在可用服务器列表中，将使用第一个可用服务器`);
      return availableServers[0];
    }
    
    // 根据消息内容选择服务器
    const lowerMessage = message.toLowerCase();
    
    // 遍历服务器配置查找匹配的服务器
    for (const server of mcpConfig.servers) {
      // 检查服务器名称是否在消息中被提及
      if (lowerMessage.includes(server.name.toLowerCase())) {
        return server.name;
      }
      
      // 检查服务器描述中的关键词是否在消息中被提及
      if (server.description && lowerMessage.includes(server.description.toLowerCase())) {
        return server.name;
      }
    }
    
    // 默认使用配置中指定的默认服务器
    return defaultServer;
  }

  /**
   * 获取MCP工具定义，以LLM可用的格式
   */
  private static getMCPToolDefinitions(): ChatCompletionTool[] {
    try {
      const tools: ChatCompletionTool[] = [];
      const servers = mcpConfig.servers;
      
      for (const server of servers) {
        const serverTools = mcpManager.getServerTools(server.name);
        
        for (const tool of serverTools) {
          // 构建LLM工具格式
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
      console.error(`获取MCP工具定义失败:`, error);
      return [];
    }
  }
  
  /**
   * 流式处理聊天请求，通过WebSocket提供实时更新
   * @param request 聊天请求
   * @param socket WebSocket连接
   * @param session 会话对象，由WebSocket连接处理提供
   * @returns 会话ID
   */
  static async streamChat(request: ChatRequest, socket: WebSocket, session: ChatSession): Promise<string> {
    console.log('\n============== 项目-大模型交互记录 ==============');
    const { sessionId, message, enableTools } = request;
    
    // 保存前端传入的原始sessionId，用于返回给客户端
    const originalSessionId = sessionId;
    
    // 发送初始思考消息
    this.sendSocketMessage(socket, {
      type: 'thinking',
      content: '我正在思考您的问题...'
    });
    
    // 获取会话历史消息
    const history = session.messages;
    console.log('history', history);
    
    // 构建LLM消息
    const llmMessages: Message[] = [];
    
    // 添加系统消息（如果有）
    const systemMessage = history.find(msg => msg.role === ChatRole.SYSTEM);
    if (systemMessage) {
      llmMessages.push({
        role: 'system',
        content: systemMessage.content
      });
    }
    
    // 添加历史消息（不包括系统消息）
    const historyMessages = history.filter(msg => msg.role !== ChatRole.SYSTEM);
    console.log('historyMessages', historyMessages);
    
    // 确保所有历史消息都有正确的会话ID
    for (const msg of historyMessages) {
      // 如果消息没有会话ID或会话ID不匹配，添加警告日志
      if (!msg.sessionId) {
        console.warn(`[警告] 历史消息没有会话ID，已自动设置为当前会话ID: ${session.id}`);
        msg.sessionId = session.id;
      } else if (msg.sessionId !== session.id) {
        console.warn(`[警告] 历史消息的会话ID(${msg.sessionId})与当前会话ID(${session.id})不匹配，可能导致消息混淆`);
        // 不修改会话ID，但记录警告
      }
      
      // 只添加属于当前会话的消息到LLM消息列表
      if (msg.sessionId === session.id) {
        llmMessages.push({
          role: msg.role === ChatRole.USER ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      role: ChatRole.USER,
      content: message,
      timestamp: new Date(),
      sessionId: session.id
    };
    
    // 将用户消息添加到会话
    await SessionService.addMessage(session.id, userMessage);
    
    llmMessages.push({
      role: 'user',
      content: message
    });
    
    let assistantContent = '';
    let assistantMessage: ChatMessage;
    
    try {
      // 准备初始请求参数
      const requestOptions: any = {
        model: this.getModelName(),
        messages: llmMessages,
        temperature: 0.7
      };
      
      // 如果启用了工具，添加工具定义
      if (enableTools) {
        const mcpTools = this.getMCPToolDefinitions();
        if (mcpTools.length > 0) {
          requestOptions.tools = mcpTools;
          requestOptions.tool_choice = 'auto';
        }
      }
      
      // 发送初始请求
      let response = await this.llmService.sendChatRequest(requestOptions);
      
      // 处理消息处理的主循环
      let currentMessages = [...llmMessages];
      console.log('currentMessages', currentMessages);
      let continueProcessing = true;
      let toolCallRounds = 0;
      const MAX_TOOL_CALL_ROUNDS = 5;
      
      while (continueProcessing && toolCallRounds < MAX_TOOL_CALL_ROUNDS) {
        // 如果是第一轮，使用已经获取的响应；否则发送新请求
        let currentResponse = toolCallRounds === 0 ? response : null;
        
        if (toolCallRounds > 0 || currentResponse === null) {
          currentResponse = await this.llmService.sendChatRequest({
            model: this.getModelName(),
            messages: currentMessages,
            temperature: 0.7,
            tools: requestOptions.tools,
            tool_choice: 'auto'
          });
        }
        
        // 确保currentResponse不为null
        if (!currentResponse) {
          console.error('错误: currentResponse 为 null');
          break;
        }
        
        // 获取当前响应中的消息
        const currentResponseMessage = currentResponse.choices[0].message;
        
        // 始终发送文本内容（如果有），即使存在工具调用
        if (currentResponseMessage.content) {
          this.sendSocketMessage(socket, {
            type: 'assistant_message',
            content: currentResponseMessage.content
          });
          
          // 累积助手内容，用于最终存储
          if (!assistantContent) {
            assistantContent = currentResponseMessage.content;
          } else {
            assistantContent += "\n\n" + currentResponseMessage.content;
          }
          
          // 立即存储此条助手消息到数据库
          const assistantPartialMessage: ChatMessage = {
            role: ChatRole.ASSISTANT,
            content: currentResponseMessage.content,
            timestamp: new Date(),
            sessionId: session.id
          };
          
          await SessionService.addMessage(session.id, assistantPartialMessage);
        }
        
        // 如果没有工具调用，或者已经到达最后一轮，处理结束
        if (!currentResponseMessage.tool_calls || 
            currentResponseMessage.tool_calls.length === 0 || 
            toolCallRounds === MAX_TOOL_CALL_ROUNDS - 1) {
          
          // 终止循环
          continueProcessing = false;
          break;
        }
        
        // 将当前响应添加到消息列表
        currentMessages.push(currentResponseMessage);
        console.log('currentResponseMessage', currentResponseMessage);
        
        // 处理所有工具调用
        for (const toolCall of currentResponseMessage.tool_calls) {
          if (toolCall.type !== 'function') {
            continue;
          }
          
          const toolName = toolCall.function.name;
          console.log(`\n[工具调用] ${toolName}`);
          
          let toolArgs: Record<string, any> = {};
          
          try {
            toolArgs = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
            
            // 告知用户即将调用工具
              this.sendSocketMessage(socket, {
                type: 'tool_calling',
                content: `我需要使用 ${toolName} 工具来查询相关信息...`,
                tool: {
                  name: toolName,
                  args: toolArgs
                }
              });
            
            // 执行工具调用
            const result = await mcpManager.callTool(toolName, toolArgs);
            
            // 从结果中提取内容
            let resultContent = '';
            if (result.content && result.content.length > 0) {
              // 遍历所有内容项
              for (const contentItem of result.content) {
                // 根据内容类型处理
                const itemType = contentItem.type || 'unknown';
                
                if (itemType === 'text') {
                  // 处理文本内容
                  const textContent = (contentItem as TextContent).text;
                  resultContent += textContent;
                } else if (itemType === 'image') {
                  // 处理图像内容
                  const imageContent = contentItem as ImageContent;
                  const imageInfo = `[图像: MIME类型 ${imageContent.mimeType}, base64数据长度: ${imageContent.data.length}]`;
                  resultContent += imageInfo;
                } else if (itemType === 'embedded_resource') {
                  // 处理嵌入资源
                  const resourceContent = contentItem as EmbeddedResource;
                  const resourceInfo = `[嵌入资源: ${JSON.stringify(resourceContent.resource)}]`;
                  resultContent += resourceInfo;
                }
              }
            }
            
            // 记录工具调用结果
            console.log(`[工具结果] ${resultContent.substring(0, 500)}${resultContent.length > 500 ? '...' : ''}`);
            
            // 发送工具结果的指示
            this.sendSocketMessage(socket, {
              type: 'thinking',
              content: `我已获取到 ${toolName} 的数据`
            });
            
            // 将工具结果添加到消息列表
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: resultContent
            });
            
          } catch (error) {
            console.error(`[工具错误] ${error}`);
            const errorMessage = `工具调用失败: ${error instanceof Error ? error.message : String(error)}`;
            
            // 告知用户工具调用失败
            this.sendSocketMessage(socket, {
              type: 'tool_error',
              content: `工具 ${toolName} 调用失败: ${errorMessage}`
            });
            
            // 将错误结果添加到消息列表
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: errorMessage
            });
          }
        }
        
        // 增加工具调用轮数计数
        toolCallRounds++;
      }
      
      // 如果达到最大轮数但仍有未完成的工具调用，发送最后一次总结请求
      if (toolCallRounds >= MAX_TOOL_CALL_ROUNDS && continueProcessing) {
        console.log(`\n[达到工具调用上限] 请求总结回答`);
        
        // 添加总结请求
        currentMessages.push({
          role: 'user',
          content: '请基于到目前为止的所有信息，提供一个完整的总结回答。'
        });
        
        const finalResponse = await this.llmService.sendChatRequest({
          model: this.getModelName(),
          messages: currentMessages,
          temperature: 0.7
        });
        
        // 处理总结响应
        const finalSummaryMessage = finalResponse.choices[0].message;
        if (finalSummaryMessage.content) {
          // 发送总结消息给客户端
          this.sendSocketMessage(socket, {
            type: 'assistant_message',
            content: finalSummaryMessage.content
          });
          
          assistantContent = finalSummaryMessage.content;
          
          // 立即存储总结消息到数据库
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
      console.error('[错误] 处理聊天请求失败:', error);
      const errorMessage = `很抱歉，在处理您的请求时遇到了问题: ${error instanceof Error ? error.message : String(error)}`;
      
      // 发送错误信息
      this.sendSocketMessage(socket, {
        type: 'error',
        content: errorMessage
      });
      
      assistantContent = errorMessage;
      
      // 立即存储错误消息到数据库
      const errorAssistantMessage: ChatMessage = {
        role: ChatRole.ASSISTANT,
        content: errorMessage,
        timestamp: new Date(),
        sessionId: session.id
      };
      await SessionService.addMessage(session.id, errorAssistantMessage);
    }
    
    // 发送完成信号 - 使用前端传入的原始sessionId
    this.sendSocketMessage(socket, {
      type: 'complete',
      sessionId: originalSessionId
    });
    
    console.log('\n============== 交互记录结束 ==============\n');
    
    return session.id;
  }
  
  /**
   * 发送WebSocket消息
   * @private
   */
  private static sendSocketMessage(socket: WebSocket, message: any): void {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket连接已关闭，无法发送消息');
    }
  }
} 