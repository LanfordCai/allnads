import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatMessage, ChatRequest, AppChatResponse, ChatRole } from '../types/chat';
import { llm } from './llm';
import { SessionService } from './session';
import { v4 as uuidv4 } from 'uuid';
import { TextContent } from '../types/mcp';
import { mcpManager } from './mcpService';
import { mcpConfig } from '../config/mcpConfig';

/**
 * 聊天服务
 */
export class ChatService {
  // 存储聊天会话
  private static sessions: Map<string, ChatMessage[]> = new Map();

  /**
   * 检测是否需要调用MCP工具
   * 简单实现：检查消息中是否包含触发词
   */
  private static shouldUseMCPTool(message: string): boolean {
    const triggers = [
      '使用工具', '调用工具', '用工具', 
      '查询', '获取',
      'gas', 'gas价格', '以太坊', 'eth', '币价', '账户余额',
      '区块链', '智能合约'
    ];
    
    return triggers.some(trigger => message.toLowerCase().includes(trigger.toLowerCase()));
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
   * 尝试调用MCP工具处理查询
   */
  private static async tryCallMCPTool(message: string): Promise<string | null> {
    // 根据消息选择服务器
    const serverId = this.getServerForQuery(message);
    
    // 检查是否有gas价格查询
    if (message.toLowerCase().includes('gas') || 
        message.toLowerCase().includes('价格') || 
        message.toLowerCase().includes('以太坊')) {
      
      try {
        // 使用选定的服务器调用gas价格工具
        const toolName = `${serverId}__evm_gas_price`;
        console.log(`尝试调用MCP工具: ${toolName}`);
        
        const result = await mcpManager.callTool(toolName, {
          chain: 'ethereum' // 默认使用以太坊链
        });
        
        if (!result.isError && result.content) {
          // 提取文本内容
          const textContent = result.content.find(item => 
            item.type === 'text'
          ) as TextContent | undefined;
          
          if (textContent) {
            return `根据MCP工具查询的结果：\n${textContent.text}`;
          }
        }
        
        // 如果有错误或没有文本内容
        if (result.isError && result.content && result.content.length > 0) {
          const errorContent = result.content[0] as TextContent;
          return `调用工具时出错：${errorContent.text}`;
        }
      } catch (error) {
        console.error('调用MCP工具失败:', error instanceof Error ? error.message : String(error));
        return '很抱歉，在调用工具时遇到了问题，请稍后再试。';
      }
    }
    
    return null; // 返回null表示没有适用的工具
  }

  /**
   * 处理聊天请求
   * @param request 聊天请求
   * @returns 聊天响应
   */
  static async processChat(request: ChatRequest): Promise<AppChatResponse> {
    const { sessionId = uuidv4(), message, systemPrompt, enableTools } = request;
    
    // 获取或创建会话
    let history = this.sessions.get(sessionId) || [];
    
    // 如果有系统提示并且是新会话，添加系统消息
    if (systemPrompt && history.length === 0) {
      history.push({
        role: ChatRole.SYSTEM,
        content: systemPrompt,
        timestamp: new Date()
      });
    }
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      role: ChatRole.USER,
      content: message,
      timestamp: new Date()
    };
    history.push(userMessage);
    
    // 生成助手响应
    let assistantContent = `You said: ${message}`;
    
    // 检查是否需要调用MCP工具
    if (enableTools || this.shouldUseMCPTool(message)) {
      try {
        // 尝试调用MCP工具
        const toolResponse = await this.tryCallMCPTool(message);
        
        if (toolResponse) {
          // 如果有工具调用结果，使用它
          assistantContent = toolResponse;
        }
      } catch (error) {
        console.error('处理工具调用失败:', error instanceof Error ? error.message : String(error));
        // 继续使用默认响应
      }
    }
    
    // 创建助手响应
    const assistantMessage: ChatMessage = {
      role: ChatRole.ASSISTANT,
      content: assistantContent,
      timestamp: new Date()
    };
    history.push(assistantMessage);
    
    // 保存会话
    this.sessions.set(sessionId, history);
    
    // 返回响应
    return {
      sessionId,
      message: assistantMessage,
      history
    };
  }
  
  /**
   * 获取会话历史
   * @param sessionId 会话ID
   * @returns 消息历史，若会话不存在则返回空数组
   */
  static getSessionHistory(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId) || [];
  }
  
  /**
   * 删除会话
   * @param sessionId 会话ID
   * @returns 是否成功删除
   */
  static deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
} 