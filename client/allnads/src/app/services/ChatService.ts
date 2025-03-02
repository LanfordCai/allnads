"use client";

import { ChatMessage, ChatSession } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

// Message types from the server
export type MessageType = 'thinking' | 'assistant_message' | 'tool_calling' | 'tool_result' | 'tool_error' | 'error' | 'complete' | 'connected';

// Event types including both message types and connection events
export type EventType = MessageType | 'open' | 'close' | 'error';

// Server message interface
export interface ServerMessage {
  type: MessageType;
  sessionId?: string;
  content?: string;
  tool?: {
    name: string;
    args: Record<string, any>;
  };
}

// Event handlers map
type EventHandlers = {
  [key in EventType]?: (data: any) => void;
};

export class ChatService {
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private eventHandlers: EventHandlers = {};
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS || '5');
  private maxReconnectDelay = parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_DELAY || '30000');
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(url: string = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3030/ws') {
    this.url = url;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        console.log('WebSocket已经连接，无需重新连接');
        resolve();
        return;
      }

      // 构建URL，附加sessionId作为查询参数
      let connectionUrl = this.url;
      if (this.sessionId) {
        // 检查URL是否已经包含查询参数
        connectionUrl += (this.url.includes('?') ? '&' : '?') + `sessionId=${this.sessionId}`;
      }

      console.log(`正在连接WebSocket: ${connectionUrl}`);
      this.socket = new WebSocket(connectionUrl);

      this.socket.onopen = () => {
        console.log('=== WebSocket连接已建立 ===');
        console.log(`连接URL: ${connectionUrl}`);
        console.log(`使用会话ID: ${this.sessionId || '未指定'}`);
        console.log('=========================');
        this.reconnectAttempts = 0;
        const openHandler = this.eventHandlers['open'];
        if (openHandler) {
          openHandler({});
        }
        resolve();
      };

      this.socket.onclose = (event) => {
        console.log('=== WebSocket连接已关闭 ===');
        console.log(`关闭代码: ${event.code}`);
        console.log(`关闭原因: ${event.reason || '无原因'}`);
        console.log('=========================');
        
        const closeHandler = this.eventHandlers['close'];
        if (closeHandler) {
          closeHandler(event);
        }

        // Attempt to reconnect if not a deliberate closure
        if (event.code !== 1000 && event.code !== 1001) {
          console.log(`连接非正常关闭 (代码 ${event.code}), 准备重新连接...`);
          this.attemptReconnect();
        }
      };

      this.socket.onerror = (error) => {
        console.error('=== WebSocket发生错误 ===');
        console.error(error);
        console.error('=======================');
        
        const errorHandler = this.eventHandlers['error'];
        if (errorHandler) {
          errorHandler(error);
        }
        
        reject(error);
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('=== WebSocket重连失败 ===');
      console.error(`已达到最大重连次数: ${this.maxReconnectAttempts}次`);
      console.error('=======================');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    
    console.log('=== WebSocket准备重连 ===');
    console.log(`重连尝试: ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    console.log(`延迟时间: ${delay}ms`);
    console.log('========================');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      console.log(`开始第${this.reconnectAttempts}次重连...`);
      this.connect().catch(error => {
        console.error(`第${this.reconnectAttempts}次重连失败:`, error);
      });
    }, delay);
  }

  private handleMessage(data: string) {
    try {
      // 打印原始消息
      console.log('=== WebSocket 收到原始消息 ===');
      console.log(data);
      console.log('=========================');

      const message = JSON.parse(data) as ServerMessage;
      
      // 打印格式化的消息对象
      console.log(`=== 解析后的消息 [类型: ${message.type}] ===`);
      console.log(JSON.stringify(message, null, 2));
      console.log('=========================');

      // Save session ID if present
      if (message.sessionId) {
        this.sessionId = message.sessionId;
        console.log(`会话ID已更新: ${this.sessionId}`);
      }

      // Call appropriate event handler
      if (message.type && this.eventHandlers[message.type]) {
        console.log(`正在处理 "${message.type}" 类型的消息`);
        const handler = this.eventHandlers[message.type];
        if (handler) {
          handler(message);
        }
      } else {
        console.warn(`没有处理程序处理 "${message.type}" 类型的消息`);
      }
    } catch (error) {
      console.error('消息解析失败:', error);
      console.error('原始消息:', data);
    }
  }

  public sendMessage(content: string, options: {
    sessionId?: string;
    enableTools?: boolean;
  } = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not established');
    }

    const chatRequest = {
      text: content,
      sessionId: options.sessionId || this.sessionId,
      enableTools: options.enableTools !== false // Default to true
    };

    // 打印发送的消息
    console.log('=== 发送WebSocket消息 ===');
    console.log(JSON.stringify(chatRequest, null, 2));
    console.log('=========================');

    this.socket.send(JSON.stringify(chatRequest));
  }

  public on(event: EventType, callback: (data: any) => void): this {
    this.eventHandlers[event] = callback;
    return this;
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      // Use 1000 (Normal Closure) to indicate a deliberate closure
      this.socket.close(1000);
      this.socket = null;
    }
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public setSessionId(id: string) {
    // Handle empty string as null
    this.sessionId = id === '' ? null : id;
  }

  // Create a message object for local UI updates
  public createLocalMessage(content: string, role: 'user' | 'bot' | 'thinking' | 'system' | 'tool' | 'error'): ChatMessage {
    return {
      id: uuidv4(),
      content,
      role,
      timestamp: new Date()
    };
  }
} 