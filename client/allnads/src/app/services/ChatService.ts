"use client";

import { ChatMessage } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

// Message types from the server
export type MessageType = 'thinking' | 'assistant_message' | 'tool_calling' | 'tool_result' | 'tool_error' | 'error' | 'complete' | 'connected';

// Event types including both message types and connection events
export type EventType = MessageType | 'open' | 'close' | 'error' | 'auth_error';

// Define a type for tool arguments
export type ToolArgument = string | number | boolean | null | undefined | ToolArgument[] | { [key: string]: ToolArgument };

// Server message interface
export interface ServerMessage {
  type: MessageType;
  sessionId?: string;
  content?: string;
  tool?: {
    name: string;
    args: Record<string, ToolArgument>;
  };
}

// Define a type for event data based on event type
export type EventData = ServerMessage | CloseEvent | Event | Record<string, unknown>;

// Type guard to check if the event data is a ServerMessage
export function isServerMessage(data: EventData): data is ServerMessage {
  return (
    typeof data === 'object' && 
    data !== null && 
    'type' in data && 
    typeof (data as ServerMessage).type === 'string'
  );
}

// Event handlers map
type EventHandlers = {
  [key in EventType]?: (data: EventData) => void;
};

// Define a type for NFT metadata
export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  [key: string]: unknown;
}

export class ChatService {
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private eventHandlers: EventHandlers = {};
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS || '5');
  private maxReconnectDelay = parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_DELAY || '30000');
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private getPrivyTokens: (() => Promise<{ accessToken: string | null; identityToken: string | null }>) | null = null;
  
  // NFT information
  private nftTokenId: string | null = null;
  private nftAccount: string | null = null;
  private nftMetadata: NFTMetadata | null = null;

  constructor(url: string = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3030/ws') {
    this.url = url;
  }

  /**
   * 设置获取访问令牌的函数
   * @param tokenProvider 获取Privy访问令牌的函数
   */
  public setTokenProvider(tokenProvider: () => Promise<{ accessToken: string | null; identityToken: string | null }>) {
    this.getPrivyTokens = tokenProvider;
    console.log('Token provider has been set');
  }

  /**
   * Set NFT information to be included in WebSocket connection
   * @param tokenId The NFT token ID
   * @param nftAccount The NFT account address
   * @param metadata The NFT metadata
   */
  public setNFTInfo(tokenId: string | null, nftAccount: string | null, metadata: NFTMetadata | null) {
    this.nftTokenId = tokenId;
    this.nftAccount = nftAccount;
    this.nftMetadata = metadata;
    console.log('NFT information has been set', { tokenId, nftAccount, metadata });
  }

  public connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        console.log('WebSocket已经连接，无需重新连接');
        resolve();
        return;
      }

      // 构建URL，附加sessionId和认证令牌作为查询参数
      let connectionUrl = this.url;
      const queryParams = new URLSearchParams();
      
      // 添加会话ID（如果有）
      if (this.sessionId) {
        queryParams.append('sessionId', this.sessionId);
      }
      
      // 添加NFT信息（如果有）
      if (this.nftTokenId) {
        queryParams.append('nftTokenId', this.nftTokenId);
      }
      
      if (this.nftAccount) {
        queryParams.append('nftAccount', this.nftAccount);
      }
      
      if (this.nftMetadata) {
        // Use a custom replacer function to handle BigInt values
        const replacer = (key: string, value: unknown) => {
          // Convert BigInt to string
          if (typeof value === 'bigint') {
            return value.toString();
          }
          
          // Handle objects that might contain BigInt values
          if (value !== null && typeof value === 'object') {
            // Check if it's not an array and has a toString method that's not the default Object.toString
            if (!Array.isArray(value) && 
                'toString' in value &&
                value.toString !== Object.prototype.toString && 
                typeof value.toString === 'function' && 
                'constructor' in value && 
                value.constructor && 
                value.constructor.name === 'BigInt') {
              return value.toString();
            }
          }
          
          return value;
        };
        
        queryParams.append('nftMetadata', JSON.stringify(this.nftMetadata, replacer));
      }
      
      // 尝试获取认证令牌
      let accessToken = null;
      let idToken = null;
      if (this.getPrivyTokens) {
        try {
          const { accessToken: aToken, identityToken: iToken } = await this.getPrivyTokens();
          accessToken = aToken
          idToken = iToken
          
          if (accessToken && idToken) {
            queryParams.append('accessToken', accessToken);
            queryParams.append('idToken', idToken);
            console.log('已添加认证令牌到连接URL');
          } else {
            console.log('未能获取认证令牌，拒绝匿名连接');
            reject(new Error('Authentication required. Please login to use the chat.'));
            return;
          }
        } catch (error) {
          console.error('获取认证令牌失败:', error);
          reject(new Error('Failed to authenticate. Please try again.'));
          return;
        }
      } else {
        console.log('未设置令牌提供者，拒绝匿名连接');
        reject(new Error('Authentication required. Please login to use the chat.'));
        return;
      }
      
      // 如果没有令牌，拒绝连接
      if (!accessToken || !idToken) {
        console.log('没有有效的认证令牌，拒绝匿名连接');
        reject(new Error('Authentication required. Please login to use the chat.'));
        return;
      }
      
      // 添加查询参数到URL
      const queryString = queryParams.toString();
      if (queryString) {
        connectionUrl += (connectionUrl.includes('?') ? '&' : '?') + queryString;
      }

      console.log(`正在连接WebSocket`);
      this.socket = new WebSocket(connectionUrl);

      this.socket.onopen = () => {
        console.log('=== WebSocket连接已建立 ===');
        console.log(`使用会话ID: ${this.sessionId || '未指定'}`);
        console.log(`认证状态: ${queryParams.has('token') ? '已认证' : '匿名'}`);
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

        // 处理特定的认证错误
        if (event.code === 4001) {
          console.error('认证失败，令牌可能已过期或无效');
          // 可以触发特定的认证错误事件处理
          const authErrorHandler = this.eventHandlers['auth_error'];
          if (authErrorHandler) {
            authErrorHandler({ code: event.code, reason: event.reason });
          }
        }
        // Attempt to reconnect if not a deliberate closure
        else if (event.code !== 1000 && event.code !== 1001) {
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

  public on(event: EventType, callback: (data: EventData) => void): this {
    this.eventHandlers[event] = callback;
    return this;
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      // Remove event listeners to prevent memory leaks and duplicate handlers
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      
      // Use 1000 (Normal Closure) to indicate a deliberate closure
      this.socket.close(1000);
      this.socket = null;
      
      console.log('WebSocket connection closed and event listeners removed');
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
  public createLocalMessage(content: string, role: 'user' | 'bot' | 'thinking' | 'system' | 'tool' | 'error' | 'transaction_to_sign'): ChatMessage {
    return {
      id: uuidv4(),
      content,
      role,
      timestamp: new Date()
    };
  }
} 