import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatRole, ChatSession } from '../types/chat';
import { db } from '../config/database';
import { sessions, messages } from '../models/schema';
import { eq, desc, and } from 'drizzle-orm';

// 内存缓存，提高性能
const sessionsCache = new Map<string, ChatSession>();

/**
 * 会话管理服务
 */
export class SessionService {
  /**
   * 创建新的聊天会话
   */
  static async createSession(sessionId: string, systemPrompt: string, privyUserId?: string): Promise<ChatSession> {
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
    
    // 如果提供了系统提示，添加为第一条消息
    if (systemPrompt) {
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
    }
    
    // 添加到缓存
    sessionsCache.set(sessionId, session);
    
    return session;
  }
  
  /**
   * 获取会话
   */
  static async getSession(sessionId: string): Promise<ChatSession | undefined> {
    // 先从缓存中获取
    if (sessionsCache.has(sessionId)) {
      return sessionsCache.get(sessionId);
    }
    
    // 如果缓存中没有，从数据库获取
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
      
      // 添加到缓存
      sessionsCache.set(sessionId, session);
      
      return session;
    } catch (error) {
      console.error(`Error fetching session ${sessionId}:`, error);
      return undefined;
    }
  }
  
  /**
   * 添加消息到会话
   */
  static async addMessage(sessionId: string, message: ChatMessage): Promise<ChatSession> {
    // 获取会话
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // 记录消息内容，用于调试
    console.log(`[消息存储] 开始存储消息到会话 ${sessionId}`);
    console.log(`[消息存储] 角色: ${message.role}`);
    console.log(`[消息存储] 内容长度: ${message.content.length} 字符`);
    console.log(`[消息存储] 内容前100字符: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`);
    
    if (message.content === '...') {
      console.warn(`[消息存储警告] 发现内容仅为"..."的消息！`);
      console.warn(`[消息存储诊断] 消息角色: ${message.role}, 时间戳: ${message.timestamp}`);
      console.trace();  // 打印堆栈跟踪以便诊断
    }
    
    // 更新会话的最后修改时间
    const now = new Date();
    await db.update(sessions)
      .set({ updatedAt: now })
      .where(eq(sessions.id, sessionId));
    
    // 添加新消息
    console.log(`[消息存储] 开始存储消息到数据库, message: ${message.content}`);
    const result = await db.insert(messages).values({
      sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || now,
      createdAt: now,
    });
    
    // 记录存储成功
    console.log(`[消息存储] 消息已成功存储到数据库, result: ${JSON.stringify(result)}`);
    // 获取最新添加的消息
    const latestMessage = await db.select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.timestamp))
      .limit(1);
    
    // 记录最新消息信息
    if (latestMessage.length > 0) {
      console.log(`[消息存储] 最新消息ID: ${latestMessage[0].id}`);
      console.log(`[消息存储] 最新消息时间戳: ${latestMessage[0].timestamp}`);
      console.log(`[消息存储] 最新消息内容: ${latestMessage[0].content}`);
    } else {
      console.warn(`[消息存储] 未能获取到最新消息，这可能是一个错误`);
    }
    
    // 更新缓存
    session.messages.push(message);
    session.updatedAt = now;
    sessionsCache.set(sessionId, session);
    
    return session;
  }
  
  /**
   * 获取会话历史消息
   */
  static async getHistory(sessionId: string): Promise<ChatMessage[]> {
    // 优先使用缓存
    if (sessionsCache.has(sessionId)) {
      const session = sessionsCache.get(sessionId)!;
      return [...session.messages];
    }
    
    // 如果未缓存，从数据库获取消息
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
      
      // 从缓存中移除
      sessionsCache.delete(sessionId);
      
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