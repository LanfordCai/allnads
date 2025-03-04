import { useState, useCallback, MutableRefObject } from 'react';
import { ChatService } from '../services/ChatService';
import { ChatSession } from '../types/chat';

export function useChatWebSocket(
  chatServiceRef: MutableRefObject<ChatService | null>,
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
  activeSessionIdRef: MutableRefObject<string>
) {
  const [isLoading, setIsLoading] = useState(false);

  // Function to set up chat event handlers
  const setupChatEventHandlers = useCallback(() => {
    if (!chatServiceRef.current) return;
    
    const chatService = chatServiceRef.current;
    
    // 清除所有现有的事件处理程序，防止重复
    console.log('清除现有的事件处理程序，重新设置...');
    
    // 重新设置事件处理程序
    chatService
      .on('connected', (message) => {
        // 连接成功消息
        if (message.content) {
          const connectedMessage = chatService.createLocalMessage(message.content, 'system');
          
          setSessions(prevSessions => {
            // 使用ref获取最新的sessionId
            const currentSessionId = activeSessionIdRef.current;
            console.log(`Connected message received, updating session: ${currentSessionId}`);
            
            // 检查会话是否已经包含相同内容的消息，防止重复
            const sessionToUpdate = prevSessions.find(s => s.id === currentSessionId);
            if (sessionToUpdate) {
              const hasDuplicateMessage = sessionToUpdate.messages.some(
                msg => msg.role === 'system' && msg.content === message.content
              );
              
              if (hasDuplicateMessage) {
                console.log('跳过重复的连接消息');
                return prevSessions;
              }
            }
            
            return prevSessions.map(session => {
              if (session.id === currentSessionId) {
                return {
                  ...session,
                  messages: [...session.messages, connectedMessage],
                  lastActivity: new Date()
                };
              }
              return session;
            });
          });
        }
      })
      // 添加认证错误处理
      .on('auth_error', (error) => {
        console.error('WebSocket认证错误:', error);
        const errorMessage = chatService.createLocalMessage(
          '认证失败，请重新登录。如果问题持续存在，请刷新页面。', 
          'error'
        );
        
        setSessions(prevSessions => {
          const currentSessionId = activeSessionIdRef.current;
          return prevSessions.map(session => {
            if (session.id === currentSessionId) {
              return {
                ...session,
                messages: [...session.messages, errorMessage],
                lastActivity: new Date()
              };
            }
            return session;
          });
        });
      })
      .on('thinking', (message) => {
        setIsLoading(true);
         
        // 检查服务器是否返回了会话ID
        if (message.sessionId) {
          // 如果服务器返回了会话ID且与当前不同，则更新ChatService
          const currentSessionId = activeSessionIdRef.current;
          if (message.sessionId !== currentSessionId && chatServiceRef.current) {
            console.log(`服务器在thinking消息中返回了新的sessionId: ${message.sessionId}`);
            chatServiceRef.current.setSessionId(message.sessionId);
          }
        }
         
        // 不依赖于闭包中的activeSession，而是在setSessions内获取当前会话
        setSessions(prevSessions => {
          // 使用ref获取最新的sessionId
          const currentSessionId = activeSessionIdRef.current;
          // 在这里获取最新的活跃会话
          const currentActiveSession = prevSessions.find(s => s.id === currentSessionId);
          if (!currentActiveSession) {
            console.error(`No active session found with id: ${currentSessionId}`);
            return prevSessions;
          }

          console.log(`Thinking message received for session: ${currentSessionId}`);
          // 检查是否已有"thinking"消息
          const hasThinkingMessage = currentActiveSession.messages.some(msg => msg.role === 'thinking');
           
          if (message.content) {
            if (hasThinkingMessage) {
              // 更新现有的thinking消息
              return prevSessions.map(session => {
                if (session.id === currentSessionId) {
                  return {
                    ...session,
                    messages: session.messages.map(msg => 
                      msg.role === 'thinking' 
                        ? { ...msg, content: message.content || '正在思考...' }
                        : msg
                    ),
                    lastActivity: new Date()
                  };
                }
                return session;
              });
            } else {
              // 添加新的thinking消息
              const thinkingMessage = chatService.createLocalMessage(
                message.content, 
                'thinking'
              );
               
              return prevSessions.map(session => {
                if (session.id === currentSessionId) {
                  return {
                    ...session,
                    messages: [...session.messages, thinkingMessage],
                    lastActivity: new Date()
                  };
                }
                return session;
              });
            }
          }
           
          return prevSessions;
        });
      })
      .on('assistant_message', (message) => {
        setIsLoading(false);
         
        // 检查服务器是否返回了会话ID
        if (message.sessionId) {
          // 如果服务器返回了会话ID且与当前不同，则更新ChatService
          const currentSessionId = activeSessionIdRef.current;
          if (message.sessionId !== currentSessionId && chatServiceRef.current) {
            console.log(`服务器在assistant_message消息中返回了新的sessionId: ${message.sessionId}`);
            chatServiceRef.current.setSessionId(message.sessionId);
          }
        }
         
        // 更新会话，将thinking消息替换为助手消息
        if (message.content) {
          const botMessage = chatService.createLocalMessage(message.content, 'bot');
           
          setSessions(prevSessions => {
            // 使用ref获取最新的sessionId
            const currentSessionId = activeSessionIdRef.current;
            console.log(`Assistant message received for session: ${currentSessionId}`, message.content.substring(0, 50));
            return prevSessions.map(session => {
              if (session.id === currentSessionId) {
                return {
                  ...session,
                  messages: [...session.messages.filter(msg => msg.role !== 'thinking'), botMessage],
                  lastActivity: new Date()
                };
              }
              return session;
            });
          });
        }
      })
      .on('tool_calling', (message) => {
        // 显示工具调用信息
        if (message.content && message.tool) {
          // 特殊处理交易签名工具
          if (message.tool.name === 'allnads_tool__transaction_sign') {
            const { to, data, value } = message.tool.args;
            // 格式化交易签名消息，使其更清晰
            const transactionContent = `${message.content}\n\nTransaction Request:\nTo: ${to}\nData: ${data}\nValue: ${value || '0'} ETH`;
            const transactionMessage = chatService.createLocalMessage(transactionContent, 'transaction_to_sign');
             
            setSessions(prevSessions => {
              // 使用ref获取最新的sessionId
              const currentSessionId = activeSessionIdRef.current;
              console.log(`Transaction sign request received for session: ${currentSessionId}`);
              return prevSessions.map(session => {
                if (session.id === currentSessionId) {
                  return {
                    ...session,
                    // 移除thinking消息，添加交易签名消息
                    messages: [...session.messages.filter(msg => msg.role !== 'thinking'), transactionMessage],
                    lastActivity: new Date()
                  };
                }
                return session;
              });
            });
          } else {
            // 处理其他工具调用
            const toolContent = `${message.content}\n\n工具: ${message.tool.name}\n参数: ${JSON.stringify(message.tool.args, null, 2)}`;
            const toolMessage = chatService.createLocalMessage(toolContent, 'tool');
             
            setSessions(prevSessions => {
              // 使用ref获取最新的sessionId
              const currentSessionId = activeSessionIdRef.current;
              console.log(`Tool calling message received for session: ${currentSessionId}`);
              return prevSessions.map(session => {
                if (session.id === currentSessionId) {
                  return {
                    ...session,
                    // 移除thinking消息，添加工具调用消息
                    messages: [...session.messages.filter(msg => msg.role !== 'thinking'), toolMessage],
                    lastActivity: new Date()
                  };
                }
                return session;
              });
            });
          }
        }
         
        console.log('Tool being called:', message.tool);
      })
      .on('tool_result', (message) => {
        if (message.content) {
          // 添加工具结果消息
          const resultMessage = chatService.createLocalMessage(
            `工具结果: ${message.content}`, 
            'system'
          );
           
          setSessions(prevSessions => {
            // 使用ref获取最新的sessionId
            const currentSessionId = activeSessionIdRef.current;
            console.log(`Tool result message received for session: ${currentSessionId}`);
            return prevSessions.map(session => {
              if (session.id === currentSessionId) {
                return {
                  ...session,
                  messages: [...session.messages, resultMessage],
                  lastActivity: new Date()
                };
              }
              return session;
            });
          });
        }
      })
      .on('tool_error', (message) => {
        setIsLoading(false);
        if (message.content) {
          const errorMessage = chatService.createLocalMessage(
            `工具错误: ${message.content}`, 
            'error'
          );
           
          setSessions(prevSessions => {
            // 使用ref获取最新的sessionId
            const currentSessionId = activeSessionIdRef.current;
            console.log(`Tool error message received for session: ${currentSessionId}`);
            return prevSessions.map(session => {
              if (session.id === currentSessionId) {
                return {
                  ...session,
                  messages: [...session.messages.filter(msg => msg.role !== 'thinking'), errorMessage],
                  lastActivity: new Date()
                };
              }
              return session;
            });
          });
        }
      })
      .on('error', (message) => {
        setIsLoading(false);
        if (message.content) {
          const errorMessage = chatService.createLocalMessage(
            `错误: ${message.content}`, 
            'error'
          );
           
          setSessions(prevSessions => {
            // 使用ref获取最新的sessionId
            const currentSessionId = activeSessionIdRef.current;
            console.log(`Error message received for session: ${currentSessionId}`);
            return prevSessions.map(session => {
              if (session.id === currentSessionId) {
                return {
                  ...session,
                  messages: [...session.messages.filter(msg => msg.role !== 'thinking'), errorMessage],
                  lastActivity: new Date()
                };
              }
              return session;
            });
          });
        }
      })
      .on('complete', (message) => {
        setIsLoading(false);
        // 会话完成，可以选择性地显示一个完成消息
        if (message.sessionId) {
          // 如果服务器返回的sessionId与当前活跃的sessionId不同，需要更新
          const currentSessionId = activeSessionIdRef.current;
          console.log(`Chat session completed, ID: ${message.sessionId}, 当前会话ID: ${currentSessionId}`);
           
          // 从现在开始，我们发送本地生成的会话ID，服务器应该使用这个ID，而不是生成新的
          // 如果服务器仍然返回不同的ID，我们仍然更新ChatService，但不显示消息
          if (message.sessionId !== currentSessionId && chatServiceRef.current) {
            console.log(`服务器返回的sessionId (${message.sessionId}) 与当前活跃会话ID (${currentSessionId}) 不匹配，将更新ChatService的会话ID`);
             
            // 保存服务器分配的会话ID到ChatService
            chatServiceRef.current.setSessionId(message.sessionId);
          }
        }
      });
  }, [chatServiceRef, setSessions, activeSessionIdRef]);

  return {
    isLoading,
    setIsLoading,
    setupChatEventHandlers
  };
} 