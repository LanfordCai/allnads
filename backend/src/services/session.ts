import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatRole, ChatSession } from '../types/chat';
import { db } from '../config/database';
import { sessions, messages } from '../models/schema';
import { eq, desc, and } from 'drizzle-orm';

/**
 * 会话管理服务
 */
export class SessionService {
  /**
   * 创建新的聊天会话
   */
  static async createSession(sessionId: string, systemPrompt: string, privyUserId: string): Promise<ChatSession> {
    const now = new Date();
    
    // 创建会话记录
    await db.insert(sessions).values({
      id: sessionId,
      privyUserId,
      createdAt: now,
      updatedAt: now,
    });
    
    const session: ChatSession = {
      id: sessionId,
      privyUserId,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    
    // 添加 systemMessage 为第一条消息
    const systemMessage: ChatMessage = {
      role: ChatRole.SYSTEM,
      content: systemPrompt,
      timestamp: now,
    };
    
    // 添加系统消息
    await db.insert(messages).values({
      sessionId,
      role: systemMessage.role,
      content: systemMessage.content,
      timestamp: systemMessage.timestamp,
      createdAt: now,
    });
    
    session.messages.push(systemMessage);
    
    return session;
  }
  
  /**
   * 获取会话
   */
  static async getSession(sessionId: string, systemPrompt?: string): Promise<ChatSession | undefined> {
    // 从数据库获取
    try {
      // 查询会话
      const sessionResults = await db.select().from(sessions).where(eq(sessions.id, sessionId));
      
      if (sessionResults.length === 0) {
        return undefined;
      }
      
      const sessionData = sessionResults[0];
      
      // 查询会话的所有消息
      const messageResults = await db.select().from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp);

      // 检查是否有系统消息
      const hasSystemMessage = messageResults.some(msg => msg.role === ChatRole.SYSTEM);
      
      // 如果没有系统消息，或者需要替换现有的系统消息
      if (!hasSystemMessage && systemPrompt) {
        // 创建新的系统消息
        const now = new Date();
        const systemMessage: ChatMessage = {
          role: ChatRole.SYSTEM,
          content: systemPrompt,
          timestamp: now,
        };
        
        // 添加系统消息到数据库
        await db.insert(messages).values({
          sessionId,
          role: systemMessage.role,
          content: systemMessage.content,
          timestamp: systemMessage.timestamp,
          createdAt: now,
        });
        
        // 将系统消息添加到结果集的开头
        messageResults.unshift({
          id: 0, // 这个ID在返回结果中不会被使用
          sessionId,
          role: systemMessage.role,
          content: systemMessage.content,
          timestamp: systemMessage.timestamp,
          createdAt: now,
        });
      } else if (hasSystemMessage && systemPrompt) {
        // 如果有系统消息且提供了新的系统提示，则替换现有的系统消息
        const systemMessageIndex = messageResults.findIndex(msg => msg.role === ChatRole.SYSTEM);
        if (systemMessageIndex !== -1) {
          const now = new Date();
          
          // 更新数据库中的系统消息
          await db.update(messages)
            .set({ 
              content: systemPrompt,
            })
            .where(
              and(
                eq(messages.sessionId, sessionId),
                eq(messages.role, ChatRole.SYSTEM)
              )
            );
          
          // 更新结果集中的系统消息
          messageResults[systemMessageIndex].content = systemPrompt;
        }
      }
      
      // 构建会话对象
      const session: ChatSession = {
        id: sessionData.id,
        privyUserId: sessionData.privyUserId || undefined,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        messages: messageResults.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      };
      
      return session;
    } catch (error) {
      console.error(`Error fetching session ${sessionId}:`, error);
      return undefined;
    }
  }
  
  /**
   * 添加消息到会话
   */
  static async addMessage(sessionId: string, message: ChatMessage, systemPrompt?: string): Promise<ChatSession> {
    // 获取会话
    const session = await this.getSession(sessionId, systemPrompt);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // 更新会话的最后修改时间
    const now = new Date();
    await db.update(sessions)
      .set({ updatedAt: now })
      .where(eq(sessions.id, sessionId));
    
    // 添加新消息
    await db.insert(messages).values({
      sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || now,
      createdAt: now,
    });
    
    // 更新缓存
    session.messages.push(message);
    session.updatedAt = now;
    
    return session;
  }
  
  /**
   * 获取会话历史消息
   */
  static async getHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      // 检查会话存在
      const sessionExists = await db.select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.id, sessionId));
      
      if (sessionExists.length === 0) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // 查询消息
      const messageResults = await db.select().from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp);
      
      return messageResults.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));
    } catch (error) {
      console.error(`Error fetching history for session ${sessionId}:`, error);
      throw error;
    }
  }
  
  /**
   * 删除会话
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // 会话表有级联删除约束，因此删除会话会自动删除所有关联消息
      const result = await db.delete(sessions)
        .where(eq(sessions.id, sessionId));
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
      return false;
    }
  }
  
  /**
   * 获取所有会话 ID
   */
  static async getAllSessionIds(): Promise<string[]> {
    try {
      const results = await db.select({ id: sessions.id }).from(sessions);
      return results.map(result => result.id);
    } catch (error) {
      console.error('Error getting all session IDs:', error);
      return [];
    }
  }
  
  /**
   * 获取用户的所有会话 ID
   */
  static async getUserSessionIds(privyUserId: string): Promise<string[]> {
    try {
      const results = await db.select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.privyUserId, privyUserId))
        .orderBy(desc(sessions.updatedAt));
      
      return results.map(result => result.id);
    } catch (error) {
      console.error(`Error getting session IDs for user ${privyUserId}:`, error);
      return [];
    }
  }
  
  /**
   * 验证用户是否拥有会话
   */
  static async validateSessionOwnership(sessionId: string, privyUserId: string): Promise<boolean> {
    try {
      const result = await db.select({ id: sessions.id })
        .from(sessions)
        .where(and(
          eq(sessions.id, sessionId),
          eq(sessions.privyUserId, privyUserId)
        ));
      
      return result.length > 0;
    } catch (error) {
      console.error(`Error validating session ownership: ${error}`);
      return false;
    }
  }
  
  /**
   * 加载所有会话到缓存
   */
  static async loadAllSessions(): Promise<void> {
    try {
      const sessionIds = await this.getAllSessionIds();
      console.log(`Found ${sessionIds.length} sessions in database`);
      
      let loadedCount = 0;
      for (const sessionId of sessionIds) {
        await this.getSession(sessionId);
        loadedCount++;
      }
      
      console.log(`Loaded ${loadedCount} sessions into cache`);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }
} 