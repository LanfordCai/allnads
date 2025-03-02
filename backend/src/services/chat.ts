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

/**
 * 聊天服务
 */
export class ChatService {
  // 移除内部会话存储，改用SessionService
  private static llmService = new LLMService();

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
      session = await SessionService.createSession(systemPrompt);
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
        model: 'anthropic/claude-3.5-sonnet',
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
                if (contentItem.type === 'text') {
                  // 处理文本内容
                  resultContent += (contentItem as TextContent).text;
                } else if (contentItem.type === 'image') {
                  // 处理图像内容
                  const imageContent = contentItem as ImageContent;
                  resultContent += `[图像: MIME类型 ${imageContent.mimeType}, base64数据长度: ${imageContent.data.length}]`;
                } else if (contentItem.type === 'embedded_resource') {
                  // 处理嵌入资源
                  const resourceContent = contentItem as EmbeddedResource;
                  resultContent += `[嵌入资源: ${JSON.stringify(resourceContent.resource)}]`;
                }
              }
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
          model: 'anthropic/claude-3.5-sonnet',
          messages: updatedMessages,
          temperature: 0.7
        });
        
        const finalMessage = response.choices[0].message;
        if (finalMessage.content) {
          finalResponseParts.push(finalMessage.content);
        }
        
        assistantContent = finalResponseParts.join('\n\n');
      } else {
        // 没有工具调用，直接使用LLM响应
        assistantContent = assistantResponseMessage.content || '';
      }
    } catch (error) {
      console.error('处理聊天请求失败:', error);
      assistantContent = `很抱歉，在处理您的请求时遇到了问题: ${error instanceof Error ? error.message : String(error)}`;
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
    const { sessionId = uuidv4(), message, systemPrompt, enableTools } = request;
    
    // 发送初始确认
    this.sendSocketMessage(socket, {
      type: 'thinking',
      content: '我正在思考您的问题...'
    });
    
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
      session = await SessionService.createSession(systemPrompt);
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
        model: 'anthropic/claude-3.5-sonnet',
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
      this.sendSocketMessage(socket, {
        type: 'processing',
        content: '正在处理您的请求...'
      });
      
      let response = await this.llmService.sendChatRequest(requestOptions);
      let assistantResponseMessage = response.choices[0].message;
      
      // 处理初始响应
      let finalResponseParts: string[] = [];
      
      // 如果有初始回复内容，发送给用户
      if (assistantResponseMessage.content) {
        this.sendSocketMessage(socket, {
          type: 'assistant_message',
          content: assistantResponseMessage.content
        });
        finalResponseParts.push(assistantResponseMessage.content);
      }
      
      // 检查是否有工具调用
      if (enableTools && 
          assistantResponseMessage.tool_calls && 
          assistantResponseMessage.tool_calls.length > 0) {
        
        console.log(`检测到 ${assistantResponseMessage.tool_calls.length} 个工具调用请求`);
        
        // 创建新的消息列表，包含初始对话和LLM响应
        const updatedMessages = [...llmMessages, assistantResponseMessage];
        
        // 处理工具调用
        for (const toolCall of assistantResponseMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;
          
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, any> = {};
          
          try {
            toolArgs = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
            
            // 告知用户即将调用工具
            this.sendSocketMessage(socket, {
              type: 'tool_calling',
              content: `我将使用 ${toolName} 工具来帮您获取信息...`,
              tool: {
                name: toolName,
                args: toolArgs
              }
            });
            
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
                if (contentItem.type === 'text') {
                  // 处理文本内容
                  resultContent += (contentItem as TextContent).text;
                } else if (contentItem.type === 'image') {
                  // 处理图像内容
                  const imageContent = contentItem as ImageContent;
                  resultContent += `[图像: MIME类型 ${imageContent.mimeType}, base64数据长度: ${imageContent.data.length}]`;
                } else if (contentItem.type === 'embedded_resource') {
                  // 处理嵌入资源
                  const resourceContent = contentItem as EmbeddedResource;
                  resultContent += `[嵌入资源: ${JSON.stringify(resourceContent.resource)}]`;
                }
              }
            }
            
            // 告知用户工具调用结果
            this.sendSocketMessage(socket, {
              type: 'tool_result',
              content: `工具 ${toolName} 返回的结果:`,
              result: resultContent
            });
            
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
            
            // 告知用户工具调用失败
            this.sendSocketMessage(socket, {
              type: 'tool_error',
              content: `工具 ${toolName} 调用失败: ${errorMessage}`
            });
            
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
        this.sendSocketMessage(socket, {
          type: 'processing',
          content: '根据获取的信息生成最终回复...'
        });
        
        console.log('工具调用完成，发送结果给LLM获取最终响应');
        response = await this.llmService.sendChatRequest({
          model: 'anthropic/claude-3.5-sonnet',
          messages: updatedMessages,
          temperature: 0.7
        });
        
        const finalMessage = response.choices[0].message;
        if (finalMessage.content) {
          // 发送最终总结信息
          this.sendSocketMessage(socket, {
            type: 'assistant_message',
            content: finalMessage.content
          });
          
          finalResponseParts.push(finalMessage.content);
        }
        
        assistantContent = finalResponseParts.join('\n\n');
      } else {
        // 没有工具调用，直接使用LLM响应
        assistantContent = assistantResponseMessage.content || '';
      }
    } catch (error) {
      console.error('处理聊天请求失败:', error);
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
    
    return session.id;
  }
  
  /**
   * 发送WebSocket消息
   * @private
   */
  private static sendSocketMessage(socket: WebSocket, message: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket连接已关闭，无法发送消息');
    }
  }
} 