import { useState, useCallback, MutableRefObject } from 'react';
import { ChatService, isServerMessage } from '../services/ChatService';
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
    
    // Clear all existing event handlers to prevent duplication
    console.log('Clearing existing event handlers, setting up again...');
    
    // Reset event handlers
    chatService
      .on('connected', (message) => {
        // Connection success message
        if (isServerMessage(message) && message.content) {
          const connectedMessage = chatService.createLocalMessage(message.content, 'system');
          
          setSessions(prevSessions => {
            // Use ref to get the latest sessionId
            const currentSessionId = activeSessionIdRef.current;
            console.log(`Connected message received, updating session: ${currentSessionId}`);
            
            // Check if the session already contains a message with the same content to prevent duplication
            const sessionToUpdate = prevSessions.find(s => s.id === currentSessionId);
            if (sessionToUpdate) {
              const hasDuplicateMessage = sessionToUpdate.messages.some(
                msg => msg.role === 'system' && msg.content === message.content
              );
              
              if (hasDuplicateMessage) {
                console.log('Skipping duplicate connection message');
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
      // Add authentication error handling
      .on('auth_error', (error) => {
        console.error('WebSocket authentication error:', error);
        const errorMessage = chatService.createLocalMessage(
          'Authentication failed. Please log in again. If the problem persists, please refresh the page.', 
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
         
        // Check if the server returned a session ID
        if (isServerMessage(message) && message.sessionId) {
          // If the server returned a session ID that's different from the current one, update ChatService
          const currentSessionId = activeSessionIdRef.current;
          if (message.sessionId !== currentSessionId && chatServiceRef.current) {
            console.log(`Server returned a new sessionId in thinking message: ${message.sessionId}`);
            chatServiceRef.current.setSessionId(message.sessionId);
          }
        }
         
        // Don't rely on activeSession in the closure, but get the current session in setSessions
        setSessions(prevSessions => {
          // Use ref to get the latest sessionId
          const currentSessionId = activeSessionIdRef.current;
          // Get the latest active session here
          const currentActiveSession = prevSessions.find(s => s.id === currentSessionId);
          if (!currentActiveSession) {
            console.error(`No active session found with id: ${currentSessionId}`);
            return prevSessions;
          }

          console.log(`Thinking message received for session: ${currentSessionId}`);
          // Check if there's already a "thinking" message
          const hasThinkingMessage = currentActiveSession.messages.some(msg => msg.role === 'thinking');
           
          if (isServerMessage(message) && message.content) {
            if (hasThinkingMessage) {
              // Update existing thinking message
              return prevSessions.map(session => {
                if (session.id === currentSessionId) {
                  return {
                    ...session,
                    messages: session.messages.map(msg => 
                      msg.role === 'thinking' 
                        ? { ...msg, content: message.content || 'Thinking...' }
                        : msg
                    ),
                    lastActivity: new Date()
                  };
                }
                return session;
              });
            } else {
              // Add new thinking message
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
         
        // Check if the server returned a session ID
        if (isServerMessage(message) && message.sessionId) {
          // If the server returned a session ID that's different from the current one, update ChatService
          const currentSessionId = activeSessionIdRef.current;
          if (message.sessionId !== currentSessionId && chatServiceRef.current) {
            console.log(`Server returned a new sessionId in assistant_message: ${message.sessionId}`);
            chatServiceRef.current.setSessionId(message.sessionId);
          }
        }
         
        // Update session, replace thinking message with assistant message
        if (isServerMessage(message) && message.content) {
          const botMessage = chatService.createLocalMessage(message.content, 'bot');
           
          setSessions(prevSessions => {
            // Use ref to get the latest sessionId
            const currentSessionId = activeSessionIdRef.current;
            console.log(`Assistant message received for session: ${currentSessionId}`, message.content?.substring(0, 50) || '');
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
        // Display tool call information
        if (isServerMessage(message) && message.content && message.tool) {
          // Special handling for transaction signing tool
          if (message.tool.name === 'allnads_tool__transaction_sign') {
            const { to, data, value } = message.tool.args;
            // Format transaction signing message to make it clearer
            const transactionContent = `${message.content}\n\nTransaction Request:\nTo: ${to}\nData: ${data}\nValue: ${value || '0'} ETH`;
            const transactionMessage = chatService.createLocalMessage(transactionContent, 'transaction_to_sign');
             
            setSessions(prevSessions => {
              // Use ref to get the latest sessionId
              const currentSessionId = activeSessionIdRef.current;
              console.log(`Transaction sign request received for session: ${currentSessionId}`);
              return prevSessions.map(session => {
                if (session.id === currentSessionId) {
                  return {
                    ...session,
                    // Remove thinking message, add transaction signing message
                    messages: [...session.messages.filter(msg => msg.role !== 'thinking'), transactionMessage],
                    lastActivity: new Date()
                  };
                }
                return session;
              });
            });
          } else {
            // Handle other tool calls
            const toolContent = `${message.content}\n\nTool: ${message.tool.name}\nParameters: ${JSON.stringify(message.tool.args, null, 2)}`;
            const toolMessage = chatService.createLocalMessage(toolContent, 'tool');
             
            setSessions(prevSessions => {
              // Use ref to get the latest sessionId
              const currentSessionId = activeSessionIdRef.current;
              console.log(`Tool calling message received for session: ${currentSessionId}`);
              return prevSessions.map(session => {
                if (session.id === currentSessionId) {
                  return {
                    ...session,
                    // Remove thinking message, add tool call message
                    messages: [...session.messages.filter(msg => msg.role !== 'thinking'), toolMessage],
                    lastActivity: new Date()
                  };
                }
                return session;
              });
            });
          }
        }
         
        if (isServerMessage(message)) {
          console.log('Tool being called:', message.tool);
        }
      })
      .on('tool_result', (message) => {
        if (isServerMessage(message) && message.content) {
          // Add tool result message
          const resultMessage = chatService.createLocalMessage(
            `Tool result: ${message.content}`, 
            'system'
          );
           
          setSessions(prevSessions => {
            // Use ref to get the latest sessionId
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
        if (isServerMessage(message) && message.content) {
          const errorMessage = chatService.createLocalMessage(
            `Tool error: ${message.content}`, 
            'error'
          );
           
          setSessions(prevSessions => {
            // Use ref to get the latest sessionId
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
        if (isServerMessage(message) && message.content) {
          const errorMessage = chatService.createLocalMessage(
            `Error: ${message.content}`, 
            'error'
          );
           
          setSessions(prevSessions => {
            // Use ref to get the latest sessionId
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
        // Session complete, can optionally display a completion message
        if (isServerMessage(message) && message.sessionId) {
          // If the server returned sessionId is different from the current active sessionId, it needs to be updated
          const currentSessionId = activeSessionIdRef.current;
          console.log(`Chat session completed, ID: ${message.sessionId}, Current session ID: ${currentSessionId}`);
           
          // From now on, we send locally generated session IDs, the server should use this ID instead of generating a new one
          // If the server still returns a different ID, we still update ChatService, but don't display a message
          if (message.sessionId !== currentSessionId && chatServiceRef.current) {
            console.log(`Server returned sessionId (${message.sessionId}) doesn't match current active session ID (${currentSessionId}), will update ChatService's session ID`);
             
            // Save server-assigned session ID to ChatService
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