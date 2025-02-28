import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatRole, ChatSession } from '../types/chat';

// 内存中存储会话数据（生产环境应使用数据库）
const sessions = new Map<string, ChatSession>();

/**
 * 会话管理服务
 */
export class SessionService {
  /**
   * 创建新的聊天会话
   */
  static createSession(systemPrompt?: string): ChatSession {
    const sessionId = uuidv4();
    const now = new Date();
    
    const session: ChatSession = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    
    // 如果提供了系统提示，添加为第一条消息
    if (systemPrompt) {
      session.messages.push({
        role: ChatRole.SYSTEM,
        content: systemPrompt,
        timestamp: now,
      });
    }
    
    // 存储会话
    sessions.set(sessionId, session);
    
    return session;
  }
  
  /**
   * 获取会话
   */
  static getSession(sessionId: string): ChatSession | undefined {
    return sessions.get(sessionId);
  }
  
  /**
   * 添加消息到会话
   */
  static addMessage(sessionId: string, message: ChatMessage): ChatSession {
    const session = sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    session.messages.push(message);
    session.updatedAt = new Date();
    
    // 更新会话
    sessions.set(sessionId, session);
    
    return session;
  }
  
  /**
   * 获取会话历史消息
   */
  static getHistory(sessionId: string): ChatMessage[] {
    const session = sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    return [...session.messages];
  }
  
  /**
   * 删除会话
   */
  static deleteSession(sessionId: string): boolean {
    return sessions.delete(sessionId);
  }
  
  /**
   * 获取所有会话 ID
   */
  static getAllSessionIds(): string[] {
    return Array.from(sessions.keys());
  }
} 