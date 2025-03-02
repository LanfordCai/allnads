import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatMessage, ChatRequest, AppChatResponse, ChatRole, Message, ToolCall, ChatCompletionTool } from '../types/chat';
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
   * 处理聊天请求
   * @param request 聊天请求
   * @returns 聊天响应
   */
  static async processChat(request: ChatRequest): Promise<AppChatResponse> {
    const { sessionId = uuidv4(), message, systemPrompt, enableTools, includeHistory = false } = request;
    
    // 获取系统提示
    const finalSystemPrompt = getSystemPrompt();
    
    // 如果尝试设置systemPrompt，记录警告
    if (systemPrompt) {
      console.warn('API请求中尝试设置systemPrompt被忽略。为安全起见，systemPrompt只能由服务器提供。');
    }
    
    // 获取或创建会话
    let session;
    let history: ChatMessage[] = [];
    
    // 如果提供了会话ID，尝试获取现有会话
    if (sessionId) {
      session = await SessionService.getSession(sessionId);
      if (session) {
        history = session.messages;
      }
    }
    
    // 如果没有找到会话或是新会话ID，创建新会话
    if (!session) {
      session = await SessionService.createSession(finalSystemPrompt);
      history = session.messages;
    }
    
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
    for (const msg of history.filter(msg => msg.role !== ChatRole.SYSTEM)) {
      llmMessages.push({
        role: msg.role === ChatRole.USER ? 'user' : 'assistant',
        content: msg.content
      });
    }
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      role: ChatRole.USER,
      content: message,
      timestamp: new Date()
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
          console.log(`发现 ${mcpTools.length} 个可用工具`);
          requestOptions.tools = mcpTools;
          requestOptions.tool_choice = 'auto';
        } else {
          console.log('未找到可用的MCP工具');
        }
      }
      
      // 发送初始请求
      let response = await this.llmService.sendChatRequest(requestOptions);
      let assistantResponseMessage = response.choices[0].message;
      
      // 处理初始响应
      let finalResponseParts: string[] = [];
      
      // 检查是否有工具调用
      if (enableTools && 
          assistantResponseMessage.tool_calls && 
          assistantResponseMessage.tool_calls.length > 0) {
        
        console.log(`检测到 ${assistantResponseMessage.tool_calls.length} 个工具调用请求`);
        
        // 保存初始响应文本
        if (assistantResponseMessage.content) {
          finalResponseParts.push(assistantResponseMessage.content);
        }
        
        // 创建新的消息列表，包含初始对话和LLM响应
        const updatedMessages = [...llmMessages, assistantResponseMessage];
        console.log(assistantResponseMessage.tool_calls);
        
        // 处理工具调用
        for (const toolCall of assistantResponseMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;
          
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, any> = {};
          
          try {
            toolArgs = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
              
            console.log(`执行工具调用: ${toolName}`);
            console.log(`参数: ${JSON.stringify(toolArgs, null, 2)}`);
            
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
                  console.log(`添加文本内容: ${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}`);
                } else if (itemType === 'image') {
                  // 处理图像内容
                  const imageContent = contentItem as ImageContent;
                  const imageInfo = `[图像: MIME类型 ${imageContent.mimeType}, base64数据长度: ${imageContent.data.length}]`;
                  resultContent += imageInfo;
                  console.log(`添加图像内容: ${imageInfo}`);
                } else if (itemType === 'embedded_resource') {
                  // 处理嵌入资源
                  const resourceContent = contentItem as EmbeddedResource;
                  const resourceInfo = `[嵌入资源: ${JSON.stringify(resourceContent.resource)}]`;
                  resultContent += resourceInfo;
                  console.log(`添加嵌入资源: ${resourceInfo}`);
                } else {
                  console.log(`未知内容类型: ${itemType}`);
                }
              }
            } else {
              console.log('工具调用结果没有内容项');
            }
            
            console.log(`工具响应: ${resultContent}`);
            finalResponseParts.push(`[工具调用: ${toolName}]\n${resultContent}`);
            
            // 将工具结果添加到消息列表
            updatedMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: resultContent
            });
            
          } catch (error) {
            console.error(`工具调用失败: ${error}`);
            const errorMessage = `工具调用失败: ${error instanceof Error ? error.message : String(error)}`;
            finalResponseParts.push(`[工具调用错误: ${toolName}]\n${errorMessage}`);
            
            // 将错误结果添加到消息列表
            updatedMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: errorMessage
            });
          }
        }
        
        // 在所有工具调用完成后，再次请求LLM生成最终响应
        console.log('工具调用完成，发送结果给LLM获取最终响应');
        response = await this.llmService.sendChatRequest({
          model: this.getModelName(),
          messages: updatedMessages,
          temperature: 0.7
        });
        
        const finalMessage = response.choices[0].message;
        if (finalMessage.content) {
          assistantContent = finalMessage.content;
        }
      } else {
        // 没有工具调用，直接使用LLM响应
        if (assistantResponseMessage.content) {
          assistantContent = assistantResponseMessage.content;
        }
      }
    } catch (error) {
      console.error('处理聊天请求失败:', error);
      const errorMessage = `很抱歉，在处理您的请求时遇到了问题: ${error instanceof Error ? error.message : String(error)}`;
      assistantContent = errorMessage;
    }
    
    // 保存助手消息到会话
    assistantMessage = {
      role: ChatRole.ASSISTANT,
      content: assistantContent,
      timestamp: new Date()
    };
    
    await SessionService.addMessage(session.id, assistantMessage);
    
    // 返回响应 - 默认不包含历史消息，除非特别请求
    const response: AppChatResponse = {
      sessionId: session.id,
      message: assistantMessage
    };
    
    // 只有在请求中明确指定时才包含历史消息
    if (includeHistory) {
      response.history = await SessionService.getHistory(session.id);
    }
    
    return response;
  }
  
  /**
   * 获取会话历史
   */
  static async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    return SessionService.getHistory(sessionId);
  }
  
  /**
   * 删除会话
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    return SessionService.deleteSession(sessionId);
  }

  /**
   * 流式处理聊天请求，通过WebSocket提供实时更新
   * @param request 聊天请求
   * @param socket WebSocket连接
   * @returns 会话ID
   */
  static async streamChat(request: ChatRequest, socket: WebSocket): Promise<string> {
    console.log('\n============== 项目-大模型交互记录 ==============');
    const { sessionId = uuidv4(), message, systemPrompt, enableTools } = request;
    
    // 获取系统提示
    const finalSystemPrompt = getSystemPrompt();
    
    // 如果尝试设置systemPrompt，记录警告
    if (systemPrompt) {
      console.warn('流式API请求中尝试设置systemPrompt被忽略。为安全起见，systemPrompt只能由服务器提供。');
    }
    
    // 发送初始思考消息
    this.sendSocketMessage(socket, {
      type: 'thinking',
      content: '我正在思考您的问题...'
    });
    
    // 获取或创建会话
    let session;
    let history: ChatMessage[] = [];
    
    if (sessionId) {
      session = await SessionService.getSession(sessionId);
      if (session) {
        history = session.messages;
      }
    }
    
    // 如果没有找到会话或是新会话ID，创建新会话
    if (!session) {
      session = await SessionService.createSession(finalSystemPrompt);
      history = session.messages;
    }
    
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
    for (const msg of historyMessages) {
      llmMessages.push({
        role: msg.role === ChatRole.USER ? 'user' : 'assistant',
        content: msg.content
      });
    }
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      role: ChatRole.USER,
      content: message,
      timestamp: new Date()
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
          console.log(`[工具] 可用工具数量: ${mcpTools.length}`);
          requestOptions.tools = mcpTools;
          requestOptions.tool_choice = 'auto';
        }
      }
      
      // 记录发送给大模型的初始请求
      console.log('\n[发送给大模型的初始请求]');
      console.log(`消息数量: ${requestOptions.messages.length}`);
      console.log(`工具数量: ${requestOptions.tools ? requestOptions.tools.length : 0}`);
      console.log(`用户消息: ${message.substring(0, 150)}${message.length > 150 ? '...' : ''}`);
      
      // 发送初始请求
      let response = await this.llmService.sendChatRequest(requestOptions);
      
      // 记录大模型的原始响应
      console.log('\n[大模型原始响应]');
      console.log(JSON.stringify(response, null, 2));
      
      // 处理消息处理的主循环
      let currentMessages = [...llmMessages];
      let continueProcessing = true;
      let toolCallRounds = 0;
      const MAX_TOOL_CALL_ROUNDS = 5;
      
      while (continueProcessing && toolCallRounds < MAX_TOOL_CALL_ROUNDS) {
        console.log(`\n[工具调用回合 ${toolCallRounds + 1}]`);
        
        // 如果是第一轮，使用已经获取的响应；否则发送新请求
        let currentResponse = toolCallRounds === 0 ? response : null;
        
        if (toolCallRounds > 0 || currentResponse === null) {
          // 记录发送给大模型的后续请求
          console.log(`[发送给大模型的第 ${toolCallRounds + 1} 轮请求]`);
          console.log(`消息数量: ${currentMessages.length}`);
          console.log(currentMessages);
          
          currentResponse = await this.llmService.sendChatRequest({
            model: this.getModelName(),
            messages: currentMessages,
            temperature: 0.7,
            tools: requestOptions.tools,
            tool_choice: 'auto'
          });
          
          // 记录大模型的响应
          console.log(`[大模型第 ${toolCallRounds + 1} 轮响应]`);
          console.log(JSON.stringify(currentResponse, null, 2));
        }
        
        // 确保currentResponse不为null
        if (!currentResponse) {
          console.error('错误: currentResponse 为 null');
          break;
        }
        
        // 获取当前响应中的消息
        const currentResponseMessage = currentResponse.choices[0].message;
        
        // 如果没有工具调用，或者已经到达最后一轮，处理最终消息
        if (!currentResponseMessage.tool_calls || 
            currentResponseMessage.tool_calls.length === 0 || 
            toolCallRounds === MAX_TOOL_CALL_ROUNDS - 1) {
          
          // 发送最终的助手消息
          if (currentResponseMessage.content) {
            this.sendSocketMessage(socket, {
              type: 'assistant_message',
              content: currentResponseMessage.content
            });
            
            assistantContent = currentResponseMessage.content;
          }
          
          // 终止循环
          continueProcessing = false;
          break;
        }
        
        // 将当前响应添加到消息列表
        currentMessages.push(currentResponseMessage);
        
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
            
            console.log(`[工具参数] ${JSON.stringify(toolArgs, null, 2)}`);
            
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
        
        // 记录总结响应
        console.log(`[大模型总结响应]`);
        console.log(JSON.stringify(finalResponse, null, 2));
        
        // 处理总结响应
        const finalSummaryMessage = finalResponse.choices[0].message;
        if (finalSummaryMessage.content) {
          // 发送总结消息给客户端
          this.sendSocketMessage(socket, {
            type: 'assistant_message',
            content: finalSummaryMessage.content
          });
          
          assistantContent = finalSummaryMessage.content;
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
    }
    
    // 保存助手消息到会话
    assistantMessage = {
      role: ChatRole.ASSISTANT,
      content: assistantContent,
      timestamp: new Date()
    };
    
    await SessionService.addMessage(session.id, assistantMessage);
    
    // 发送完成信号
    this.sendSocketMessage(socket, {
      type: 'complete',
      sessionId: session.id
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