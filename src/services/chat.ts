import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatMessage, ChatRequest, ChatResponse, ChatRole } from '../types/chat';
import { llm } from './llm';
import { SessionService } from './session';

/**
 * 聊天服务
 */
export class ChatService {
  /**
   * 处理聊天请求
   */
  static async processChat(request: ChatRequest): Promise<ChatResponse> {
    const { message, sessionId, systemPrompt } = request;
    const now = new Date();
    
    // 获取或创建会话
    let session;
    if (sessionId) {
      session = SessionService.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
    } else {
      session = SessionService.createSession(systemPrompt);
    }
    
    // 添加用户消息到会话
    const userMessage: ChatMessage = {
      role: ChatRole.USER,
      content: message,
      timestamp: now,
    };
    
    SessionService.addMessage(session.id, userMessage);
    
    // 将会话历史转换为 LangChain 消息格式
    const history = SessionService.getHistory(session.id);
    const langchainMessages = history.map(msg => {
      if (msg.role === ChatRole.USER) {
        return new HumanMessage(msg.content);
      } else if (msg.role === ChatRole.SYSTEM) {
        return new SystemMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });
    
    try {
      // 调用 LLM
      const response = await llm.invoke(langchainMessages);
      
      // 创建助手消息并添加到会话
      const assistantMessage: ChatMessage = {
        role: ChatRole.ASSISTANT,
        content: String(response.content),
        timestamp: new Date(),
      };
      
      SessionService.addMessage(session.id, assistantMessage);
      
      // 返回响应
      return {
        sessionId: session.id,
        message: assistantMessage,
        history: SessionService.getHistory(session.id),
      };
    } catch (error) {
      console.error('Error calling LLM:', error);
      throw error;
    }
  }
} 