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
 * LLM Service - Responsible for communication with LLM API
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
   * Send chat request
   */
  async sendChatRequest(options: ChatOptions): Promise<ChatResponse> {
    // Use default values
    const requestOptions: ChatOptions = {
      ...options,
      model: options.model || this.defaultModel,
      stream: false
    };
    
    try {
      console.log(`[LLM Request] Sending request to ${this.baseUrl}/chat/completions`);
      console.log(`[LLM Request] Using model: ${requestOptions.model}`);
      console.log(`[LLM Request] Message count: ${requestOptions.messages.length}`);
      
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
        console.error(`[LLM Error] API request failed: ${error.error || response.statusText}`);
        throw new Error(`API request failed: ${error.error || response.statusText}`);
      }
      
      const responseData: ChatResponse = await response.json();
      
      // Detailed API response logging
      console.log(`[LLM Response] Status: ${response.status} ${response.statusText}`);
      console.log(`[LLM Response] Model: ${responseData.model}`);
      console.log(`[LLM Response] Token usage: ${responseData.usage?.total_tokens || 'unknown'}`);
      
      if (responseData.choices && responseData.choices.length > 0) {
        const message = responseData.choices[0].message;
        console.log(`[LLM Response] Response role: ${message.role}`);
        
        if (message.content === null) {
          console.warn(`[LLM Warning] Response content is null`);
        } else if (message.content === '...') {
          console.warn(`[LLM Warning] Response content is "..."`);
        } else if (message.content) {
          console.log(`[LLM Response] Content length: ${message.content.length} characters`);
          console.log(`[LLM Response] Content preview: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`);
        }
        
        if (message.tool_calls) {
          console.log(`[LLM Response] Tool call count: ${message.tool_calls.length}`);
        }
      }
      
      return responseData;
    } catch (error) {
      console.error('[LLM Error] Failed to send chat request:', error);
      throw error;
    }
  }

  /**
   * Stream chat request
   */
  async streamChatRequest(options: ChatOptions, callbacks: StreamCallbacks = {}): Promise<Message> {
    const { onMessage, onComplete, onError } = callbacks;
    
    // Use default values
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
      
      // Ensure response body is a readable stream
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedMessage: Message = {
        role: 'assistant',
        content: ''
      };
      
      // Read stream
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
            
            // Update accumulated message
            if (delta.role) {
              accumulatedMessage.role = delta.role;
            }
            
            if (delta.content) {
              accumulatedMessage.content = (accumulatedMessage.content || '') + delta.content;
            }
            
            // If there are tool calls
            if (delta.tool_calls) {
              if (!accumulatedMessage.tool_calls) {
                accumulatedMessage.tool_calls = [];
              }
              
              delta.tool_calls.forEach(toolCall => {
                const existingToolCall = accumulatedMessage.tool_calls?.find(tc => tc.id === toolCall.id);
                
                if (existingToolCall) {
                  // Update existing tool call
                  if (toolCall.function?.name) {
                    existingToolCall.function.name = toolCall.function.name;
                  }
                  
                  if (toolCall.function?.arguments) {
                    // Ensure string type handling
                    const existingArgs = typeof existingToolCall.function.arguments === 'string' 
                      ? existingToolCall.function.arguments 
                      : JSON.stringify(existingToolCall.function.arguments);
                      
                    const newArgs = typeof toolCall.function.arguments === 'string' 
                      ? toolCall.function.arguments 
                      : JSON.stringify(toolCall.function.arguments);
                    
                    existingToolCall.function.arguments = existingArgs + newArgs;
                  }
                } else if (toolCall.id) {
                  // Add new tool call
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
            
            // Trigger message event
            if (onMessage) {
              onMessage(delta);
            }
            
            this.emit('message', delta);
          } catch (e) {
            console.error('Error parsing stream data:', e);
          }
        }
      }
      
      // Trigger completion event
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