import { Message, ChatOptions, ChatResponse, ChatResponseChunk } from '../types/chat';
import { EventEmitter } from 'events';

interface LLMServiceConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

interface StreamCallbacks {
  onMessage?: (chunk: Partial<Message>) => void;
  onComplete?: (message: Message) => void;
  onError?: (error: Error) => void;
}

/**
 * LLM 服务 - 负责与 LLM API 进行通信
 */
export class LLMService extends EventEmitter {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: LLMServiceConfig = {}) {
    super();
    
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.defaultModel = config.defaultModel || 'gpt-4o';
    
    if (!this.apiKey) {
      console.warn('No API key provided. Set OPENROUTER_API_KEY environment variable or pass apiKey in config.');
    }
  }

  /**
   * 发送聊天请求
   */
  async sendChatRequest(options: ChatOptions): Promise<ChatResponse> {
    // 使用默认值
    const requestOptions: ChatOptions = {
      ...options,
      model: options.model || this.defaultModel,
      stream: false
    };
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://wenads-agent.com',
          'X-Title': 'WenAds Agent'
        },
        body: JSON.stringify(requestOptions)
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`API request failed: ${error.error || response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending chat request:', error);
      throw error;
    }
  }

  /**
   * 流式发送聊天请求
   */
  async streamChatRequest(options: ChatOptions, callbacks: StreamCallbacks = {}): Promise<Message> {
    const { onMessage, onComplete, onError } = callbacks;
    
    // 使用默认值
    const requestOptions: ChatOptions = {
      ...options,
      model: options.model || this.defaultModel,
      stream: true
    };
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://wenads-agent.com',
          'X-Title': 'WenAds Agent'
        },
        body: JSON.stringify(requestOptions)
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`API request failed: ${error.error || response.statusText}`);
      }
      
      // 确保返回结果是可读流
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedMessage: Message = {
        role: 'assistant',
        content: ''
      };
      
      // 读取流
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '')
          .filter(line => line.trim() !== 'data: [DONE]');
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const jsonStr = line.substring(6);
            const data = JSON.parse(jsonStr) as ChatResponseChunk;
            const { choices } = data;
            
            if (!choices || choices.length === 0) continue;
            
            const { delta } = choices[0];
            
            // 更新累积的消息
            if (delta.role) {
              accumulatedMessage.role = delta.role;
            }
            
            if (delta.content) {
              accumulatedMessage.content = (accumulatedMessage.content || '') + delta.content;
            }
            
            // 如果有工具调用
            if (delta.tool_calls) {
              if (!accumulatedMessage.tool_calls) {
                accumulatedMessage.tool_calls = [];
              }
              
              delta.tool_calls.forEach(toolCall => {
                const existingToolCall = accumulatedMessage.tool_calls?.find(tc => tc.id === toolCall.id);
                
                if (existingToolCall) {
                  // 更新现有的工具调用
                  if (toolCall.function?.name) {
                    existingToolCall.function.name = toolCall.function.name;
                  }
                  
                  if (toolCall.function?.arguments) {
                    // 确保字符串类型处理
                    const existingArgs = typeof existingToolCall.function.arguments === 'string' 
                      ? existingToolCall.function.arguments 
                      : JSON.stringify(existingToolCall.function.arguments);
                      
                    const newArgs = typeof toolCall.function.arguments === 'string' 
                      ? toolCall.function.arguments 
                      : JSON.stringify(toolCall.function.arguments);
                    
                    existingToolCall.function.arguments = existingArgs + newArgs;
                  }
                } else if (toolCall.id) {
                  // 添加新的工具调用
                  accumulatedMessage.tool_calls?.push({
                    id: toolCall.id,
                    type: toolCall.type || 'function',
                    function: {
                      name: toolCall.function?.name || '',
                      arguments: toolCall.function?.arguments || ''
                    }
                  });
                }
              });
            }
            
            // 触发消息事件
            if (onMessage) {
              onMessage(delta);
            }
            
            this.emit('message', delta);
          } catch (e) {
            console.error('Error parsing stream data:', e);
          }
        }
      }
      
      // 触发完成事件
      if (onComplete) {
        onComplete(accumulatedMessage);
      }
      
      this.emit('complete', accumulatedMessage);
      return accumulatedMessage;
      
    } catch (error) {
      console.error('Error streaming chat request:', error);
      
      if (onError && error instanceof Error) {
        onError(error);
      }
      
      this.emit('error', error);
      throw error;
    }
  }
} 