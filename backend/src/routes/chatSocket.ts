import WebSocket from 'ws';
import { ChatService } from '../services/chat';
import { ChatRequest } from '../types/chat';
import http from 'http';
import url from 'url';
import { getSystemPrompt } from '../config/prompts';
import { SessionService } from '../services/session';
import { v4 as uuidv4 } from 'uuid';
/**
 * WebSocket聊天服务
 */
export class ChatSocketService {
  private wss: WebSocket.Server;
  private static instance: ChatSocketService;
  
  /**
   * 初始化WebSocket服务
   * @param server HTTP服务器实例
   */
  constructor(server: http.Server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });
    this.init();
    ChatSocketService.instance = this;
  }
  
  /**
   * 初始化WebSocket连接处理
   */
  private init(): void {
    this.wss.on('connection', async (socket, request) => {
      console.log('WebSocket连接已建立');
      
      // 解析查询参数
      const queryParams = url.parse(request.url || '', true).query;
      const sessionId = queryParams.sessionId as string;
      console.log(`会话ID: ${sessionId}`);
      
      // 获取或创建会话
      let session;
      let finalSessionId = sessionId;
      
      // 获取系统提示词
      const systemPrompt = getSystemPrompt();
      
      if (sessionId) {
        // 尝试获取现有会话
        session = await SessionService.getSession(sessionId);
        
        // 如果会话不存在，则创建一个新会话
        if (!session) {
          console.log(`会话不存在，创建新会话: ${sessionId}`);
          session = await SessionService.createSession(sessionId, systemPrompt);
          finalSessionId = session.id;
        }
      } else {
        // 如果没有提供会话ID，直接创建新会话
        console.log('未提供会话ID，创建新会话');
        session = await SessionService.createSession(uuidv4(), systemPrompt);
        finalSessionId = session.id;
      }
      
      console.log(`最终会话ID: ${finalSessionId}`);
      console.log(`会话历史: ${session.messages.length} 条消息`);
      
      // 判断会话历史是否为空(只有系统提示消息时也视为空)
      const historyIsEmpty = session.messages.length <= 1;
      
      // 只在会话历史为空时发送欢迎消息
      if (historyIsEmpty) {
        socket.send(JSON.stringify({
          type: 'connected',
          sessionId: finalSessionId,
          content: `👋 欢迎使用聊天服务！您的会话ID是: ${finalSessionId}。现在可以开始聊天了，请在输入框中输入您的问题。服务器将使用区块链工具帮助您解答疑问。`
        }));
      }
      
      // 处理消息
      socket.on('message', async (data) => {
        try {
          // 解析客户端消息
          const message = JSON.parse(data.toString());
          
          // 验证消息格式
          if (!message.text) {
            socket.send(JSON.stringify({
              type: 'error',
              content: '无效的消息格式，缺少text字段'
            }));
            return;
          }
          
          // 构建聊天请求
          const chatRequest: ChatRequest = {
            sessionId: finalSessionId,
            message: message.text,
            enableTools: message.enableTools !== false // 默认启用工具
          };
          
          // 处理聊天请求并流式返回结果
          await ChatService.streamChat(chatRequest, socket, session);
          
        } catch (error) {
          console.error('处理WebSocket消息时发生错误:', error);
          socket.send(JSON.stringify({
            type: 'error',
            content: `处理消息时发生错误: ${error instanceof Error ? error.message : String(error)}`
          }));
        }
      });
      
      // 处理关闭连接
      socket.on('close', () => {
        console.log('WebSocket连接已关闭');
      });
      
      // 处理错误
      socket.on('error', (error) => {
        console.error('WebSocket错误:', error);
      });
    });
  }
  
  /**
   * 关闭WebSocket服务器
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }
      
      this.wss.close((err) => {
        if (err) {
          console.error('关闭WebSocket服务器时出错:', err);
          reject(err);
        } else {
          console.log('WebSocket服务器已安全关闭');
          resolve();
        }
      });
    });
  }
  
  /**
   * 获取服务实例
   */
  public static getInstance(): ChatSocketService | undefined {
    return this.instance;
  }
}

/**
 * 初始化聊天WebSocket服务
 * @param server HTTP服务器实例
 */
export function initializeChatWebSocket(server: http.Server): ChatSocketService {
  const service = new ChatSocketService(server);
  console.log('聊天WebSocket服务已初始化');
  return service;
}

/**
 * 关闭聊天WebSocket服务
 */
export async function closeChatWebSocket(): Promise<void> {
  const instance = ChatSocketService.getInstance();
  if (instance) {
    await instance.close();
  }
} 