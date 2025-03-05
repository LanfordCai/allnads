import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatRole, ChatSession } from '../types/chat';
import { db } from '../config/database';
import { sessions, messages } from '../models/schema';
import { eq, desc, and, ne } from 'drizzle-orm';
import { ChatSocketService } from '../routes/chatSocket';

const sessionsCache = new Map<string, ChatSession>();
/**
 * Session Management Service
 */
export class SessionService {
  /**
   * Create a new chat session
   */
  static async createSession(sessionId: string, systemPrompt: string, privyUserId: string): Promise<ChatSession> {
    const now = new Date();
    
    // Create session record
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
    
    // Add systemMessage as the first message
    const systemMessage: ChatMessage = {
      role: ChatRole.SYSTEM,
      content: systemPrompt,
      timestamp: now,
      sessionId: sessionId
    };
    
    // Add system message
    await db.insert(messages).values({
      sessionId,
      role: systemMessage.role,
      content: systemMessage.content,
      timestamp: systemMessage.timestamp,
      toolCallId: null,
      toolName: null,
      createdAt: now,
    });
    
    session.messages.push(systemMessage);
    sessionsCache.set(sessionId, session);
    
    return session;
  }
  
  /**
   * Get session
   */
  static async getSession(sessionId: string, systemPrompt?: string): Promise<ChatSession | undefined> {
    // Get from database
    try {
      // Query session
      const sessionResults = await db.select().from(sessions).where(eq(sessions.id, sessionId));
      
      if (sessionResults.length === 0) {
        return undefined;
      }
      
      const sessionData = sessionResults[0];
      
      // Query all messages for the session
      const messageResults = await db.select().from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp);

      // Check if there's a system message
      const hasSystemMessage = messageResults.some(msg => msg.role === ChatRole.SYSTEM);
      
      // If no system message, or need to replace existing system message
      if (!hasSystemMessage && systemPrompt) {
        // Create new system message
        const now = new Date();
        const systemMessage: ChatMessage = {
          role: ChatRole.SYSTEM,
          content: systemPrompt,
          timestamp: now,
          sessionId: sessionId
        };
        
        // Add system message to database
        await db.insert(messages).values({
          sessionId,
          role: systemMessage.role,
          content: systemMessage.content,
          timestamp: systemMessage.timestamp,
          toolCallId: null,
          toolName: null,
          createdAt: now,
        });
        
        // Add system message to the beginning of the result set
        messageResults.unshift({
          id: 0, // This ID won't be used in the return result
          sessionId,
          role: systemMessage.role,
          content: systemMessage.content,
          timestamp: systemMessage.timestamp,
          toolCallId: null,
          toolName: null,
          createdAt: now,
        });
      } else if (hasSystemMessage && systemPrompt) {
        // If there's a system message and a new system prompt is provided, replace the existing system message
        const systemMessageIndex = messageResults.findIndex(msg => msg.role === ChatRole.SYSTEM);
        if (systemMessageIndex !== -1) {
          const now = new Date();
          
          // Update system message in database
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
          
          // Update system message in result set
          messageResults[systemMessageIndex].content = systemPrompt;
        }
      }
      
      // Build session object
      const session: ChatSession = {
        id: sessionData.id,
        privyUserId: sessionData.privyUserId || undefined,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        messages: messageResults.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          sessionId: sessionId,
          toolCallId: msg.toolCallId || undefined,
          toolName: msg.toolName || undefined
        })),
      };

      // Add to cache
      sessionsCache.set(sessionId, session);
      
      return session;
    } catch (error) {
      console.error(`Error fetching session ${sessionId}:`, error);
      return undefined;
    }
  }
  
  /**
   * Add message to session
   */
  static async addMessage(sessionId: string, message: ChatMessage, systemPrompt?: string): Promise<ChatSession> {
    // Get session
    const session = await this.getSession(sessionId, systemPrompt);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // Ensure message has correct session ID
    if (message.sessionId && message.sessionId !== sessionId) {
      console.warn(`[Warning] Message session ID(${message.sessionId}) doesn't match target session ID(${sessionId}), automatically corrected`);
      message.sessionId = sessionId;
    } else if (!message.sessionId) {
      message.sessionId = sessionId;
    }
    
    // Update session's last modified time
    const now = new Date();
    await db.update(sessions)
      .set({ updatedAt: now })
      .where(eq(sessions.id, sessionId));
    
    // Add new message
    await db.insert(messages).values({
      sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || now,
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      createdAt: now,
    });
    
    // Update cache
    session.messages.push(message);
    session.updatedAt = now;
    sessionsCache.set(sessionId, session);

    
    return session;
  }
  
  /**
   * Get session history messages
   */
  static async getHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      // Check session exists
      const sessionExists = await db.select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.id, sessionId));
      
      if (sessionExists.length === 0) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Query messages
      const messageResults = await db.select().from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp);
      
      return messageResults.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        sessionId: sessionId,
        toolCallId: msg.toolCallId || undefined,
        toolName: msg.toolName || undefined
      }));
    } catch (error) {
      console.error(`Error fetching history for session ${sessionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Sessions table has cascade delete constraint, so deleting a session will automatically delete all associated messages
      const result = await db.delete(sessions)
        .where(eq(sessions.id, sessionId));

      sessionsCache.delete(sessionId);
      
      // Clear welcome message tracking for this session
      ChatSocketService.clearWelcomeMessageTracking(sessionId);
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
      return false;
    }
  }
  
  /**
   * Reset session messages (delete all messages except system prompt)
   */
  static async resetSession(sessionId: string, systemPrompt?: string): Promise<boolean> {
    try {
      // Check if session exists
      const sessionExists = await db.select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.id, sessionId));
      
      if (sessionExists.length === 0) {
        return false;
      }
      
      // Delete all non-system messages
      await db.delete(messages)
        .where(
          and(
            eq(messages.sessionId, sessionId),
            ne(messages.role, ChatRole.SYSTEM)
          )
        );
      
      // Update system message if provided
      if (systemPrompt) {
        const systemMessageExists = await db.select().from(messages)
          .where(
            and(
              eq(messages.sessionId, sessionId),
              eq(messages.role, ChatRole.SYSTEM)
            )
          );
        
        if (systemMessageExists.length > 0) {
          // Update existing system message
          await db.update(messages)
            .set({ content: systemPrompt })
            .where(
              and(
                eq(messages.sessionId, sessionId),
                eq(messages.role, ChatRole.SYSTEM)
              )
            );
        } else {
          // Create new system message
          const now = new Date();
          await db.insert(messages).values({
            sessionId,
            role: ChatRole.SYSTEM,
            content: systemPrompt,
            timestamp: now,
            toolCallId: null,
            toolName: null,
            createdAt: now,
          });
        }
      }
      
      // Remove from cache to force reload
      sessionsCache.delete(sessionId);
      
      // Clear welcome message tracking for this session
      ChatSocketService.clearWelcomeMessageTracking(sessionId);
      
      return true;
    } catch (error) {
      console.error(`Error resetting session ${sessionId}:`, error);
      return false;
    }
  }
  
  /**
   * Get all session IDs
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
   * Get user's all session IDs
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
   * Validate user ownership of session
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
   * Load all sessions into cache
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