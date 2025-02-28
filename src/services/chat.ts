import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatMessage, ChatRequest, AppChatResponse, ChatRole } from '../types/chat';
import { llm } from './llm';
import { SessionService } from './session';
import { v4 as uuidv4 } from 'uuid';

/**
 * 聊天服务
 */
export class ChatService {
  // 存储聊天会话
  private static sessions: Map<string, ChatMessage[]> = new Map();

  /**
   * 处理聊天请求
   * @param request 聊天请求
   * @returns 聊天响应
   */
  static async processChat(request: ChatRequest): Promise<AppChatResponse> {
    const { sessionId = uuidv4(), message, systemPrompt } = request;
    
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
    
    // 创建助手响应 (这里简单回显)
    const assistantMessage: ChatMessage = {
      role: ChatRole.ASSISTANT,
      content: `You said: ${message}`,
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