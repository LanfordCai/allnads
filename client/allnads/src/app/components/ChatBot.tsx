"use client"

import { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatSession, WalletInfo } from '../types/chat';
import ChatHistory from './ChatHistory';
import ChatArea from './ChatArea';
import AppArea from './AppArea';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../services/ChatService';

// Mock wallet info for now (this could come from another API in a real app)
const mockWalletInfo: WalletInfo = {
  balance: '0.00',
  username: 'lanford_33',
  avatarUrl: '/avatar.png',
};

const initialSession: ChatSession = {
  id: uuidv4(),
  title: 'New Chat',
  messages: [],
  lastActivity: new Date(),
};

export default function ChatBot() {
  // Session management
  const [sessions, setSessions] = useState<ChatSession[]>([initialSession]);
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSession.id);
  
  // UI state management
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Screen size states
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);

  // Chat service reference to maintain a single instance
  const chatServiceRef = useRef<ChatService | null>(null);

  // Get active session
  const activeSession = sessions.find(session => session.id === activeSessionId) || initialSession;

  // Initialize chat service and set up event handlers
  useEffect(() => {
    const chatService = new ChatService();
    chatServiceRef.current = chatService;

    // 设置事件处理器
    chatService
      .on('connected', (message) => {
        // 连接成功消息
        if (message.content) {
          const connectedMessage = chatService.createLocalMessage(message.content, 'system');
          
          setSessions(prevSessions => prevSessions.map(session => {
            if (session.id === activeSessionId) {
              return {
                ...session,
                messages: [...session.messages, connectedMessage],
                lastActivity: new Date()
              };
            }
            return session;
          }));
        }
      })
      .on('thinking', (message) => {
        setIsLoading(true);
        
        // 检查是否已有"thinking"消息
        const hasThinkingMessage = activeSession.messages.some(msg => msg.sender === 'thinking');
        
        if (message.content) {
          if (hasThinkingMessage) {
            // 更新现有的thinking消息
            setSessions(prevSessions => prevSessions.map(session => {
              if (session.id === activeSessionId) {
                return {
                  ...session,
                  messages: session.messages.map(msg => 
                    msg.sender === 'thinking' 
                      ? { ...msg, content: message.content || '正在思考...' }
                      : msg
                  ),
                  lastActivity: new Date()
                };
              }
              return session;
            }));
          } else {
            // 添加新的thinking消息
            const thinkingMessage = chatService.createLocalMessage(
              message.content, 
              'thinking'
            );
            
            setSessions(prevSessions => prevSessions.map(session => {
              if (session.id === activeSessionId) {
                return {
                  ...session,
                  messages: [...session.messages, thinkingMessage],
                  lastActivity: new Date()
                };
              }
              return session;
            }));
          }
        }
      })
      .on('assistant_message', (message) => {
        setIsLoading(false);
        
        // 更新会话，将thinking消息替换为助手消息
        if (message.content) {
          const botMessage = chatService.createLocalMessage(message.content, 'bot');
          
          setSessions(prevSessions => prevSessions.map(session => {
            if (session.id === activeSessionId) {
              return {
                ...session,
                messages: [...session.messages.filter(msg => msg.sender !== 'thinking'), botMessage],
                lastActivity: new Date()
              };
            }
            return session;
          }));
        }
      })
      .on('tool_calling', (message) => {
        // 显示工具调用信息
        if (message.content && message.tool) {
          // 格式化工具调用消息
          const toolContent = `${message.content}\n\n工具: ${message.tool.name}\n参数: ${JSON.stringify(message.tool.args, null, 2)}`;
          const toolMessage = chatService.createLocalMessage(toolContent, 'tool');
          
          setSessions(prevSessions => prevSessions.map(session => {
            if (session.id === activeSessionId) {
              return {
                ...session,
                // 移除thinking消息，添加工具调用消息
                messages: [...session.messages.filter(msg => msg.sender !== 'thinking'), toolMessage],
                lastActivity: new Date()
              };
            }
            return session;
          }));
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
          
          setSessions(prevSessions => prevSessions.map(session => {
            if (session.id === activeSessionId) {
              return {
                ...session,
                messages: [...session.messages, resultMessage],
                lastActivity: new Date()
              };
            }
            return session;
          }));
        }
      })
      .on('tool_error', (message) => {
        setIsLoading(false);
        if (message.content) {
          const errorMessage = chatService.createLocalMessage(
            `工具错误: ${message.content}`, 
            'error'
          );
          
          setSessions(prevSessions => prevSessions.map(session => {
            if (session.id === activeSessionId) {
              return {
                ...session,
                messages: [...session.messages.filter(msg => msg.sender !== 'thinking'), errorMessage],
                lastActivity: new Date()
              };
            }
            return session;
          }));
        }
      })
      .on('error', (message) => {
        setIsLoading(false);
        if (message.content) {
          const errorMessage = chatService.createLocalMessage(
            `错误: ${message.content}`, 
            'error'
          );
          
          setSessions(prevSessions => prevSessions.map(session => {
            if (session.id === activeSessionId) {
              return {
                ...session,
                messages: [...session.messages.filter(msg => msg.sender !== 'thinking'), errorMessage],
                lastActivity: new Date()
              };
            }
            return session;
          }));
        }
      })
      .on('complete', (message) => {
        setIsLoading(false);
        // 会话完成，可以选择性地显示一个完成消息
        if (message.sessionId) {
          console.log('Chat session completed, ID:', message.sessionId);
        }
      });

    // Connect to the WebSocket server
    chatService.connect().catch(error => {
      console.error('Failed to connect to chat server:', error);
      // Show a connection error message to the user
      const errorMessage = chatService.createLocalMessage(
        '无法连接到聊天服务器。请稍后再试。', 
        'error'
      );
      
      setSessions(prevSessions => prevSessions.map(session => {
        if (session.id === activeSessionId) {
          return {
            ...session,
            messages: [...session.messages, errorMessage],
            lastActivity: new Date()
          };
        }
        return session;
      }));
    });

    // Clean up on unmount
    return () => {
      chatService.disconnect();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      // Get breakpoints from environment variables or use defaults
      const mobileBreakpoint = parseInt(process.env.NEXT_PUBLIC_MOBILE_BREAKPOINT || '768');
      const largeScreenBreakpoint = parseInt(process.env.NEXT_PUBLIC_LARGE_SCREEN_BREAKPOINT || '1024');
      
      setIsMobile(window.innerWidth < mobileBreakpoint); // Mobile breakpoint
      setIsLargeScreen(window.innerWidth >= largeScreenBreakpoint); // Large screen breakpoint
    };

    // Initial check
    checkScreenSize();

    // Add event listener for window resize
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Handle sending a message
  const handleSendMessage = (content: string) => {
    if (!chatServiceRef.current) {
      console.error('Chat service not initialized');
      return;
    }

    // Create and add user message to UI immediately
    const userMessage = chatServiceRef.current.createLocalMessage(content, 'user');
    
    // Set loading state
    setIsLoading(true);
    
    // Update the session
    setSessions(prevSessions => prevSessions.map(session => {
      if (session.id === activeSessionId) {
        // Update session title with first message if this is a new chat
        const title = session.messages.length === 0 
          ? (content.length > 30 ? content.substring(0, 27) + '...' : content)
          : session.title;
        
        return {
          ...session,
          title,
          messages: [...session.messages, userMessage],
          lastActivity: new Date()
        };
      }
      return session;
    }));

    // Send the message to the server
    try {
      const currentSessionId = chatServiceRef.current.getSessionId();
      chatServiceRef.current.sendMessage(content, {
        sessionId: currentSessionId || undefined,
        enableTools: true
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Update UI to show error
      const errorMessage = chatServiceRef.current.createLocalMessage(
        'Failed to send message. Please check your connection.', 
        'bot'
      );
      
      setSessions(prevSessions => prevSessions.map(session => {
        if (session.id === activeSessionId) {
          return {
            ...session,
            messages: [...session.messages, errorMessage],
            lastActivity: new Date()
          };
        }
        return session;
      }));
      
      setIsLoading(false);
    }
  };

  // Select a chat session
  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (!isLargeScreen) {
      setHistoryOpen(false);
    }
    
    // If chatService has a different sessionId, update it
    if (chatServiceRef.current) {
      const currentSession = sessions.find(session => session.id === sessionId);
      if (currentSession) {
        chatServiceRef.current.setSessionId(sessionId);
      }
    }
  };

  // Create new chat
  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      lastActivity: new Date(),
    };

    setSessions([...sessions, newSession]);
    setActiveSessionId(newSession.id);
    if (!isLargeScreen) {
      setHistoryOpen(false);
    }
    
    // Clear the session ID in the chat service
    if (chatServiceRef.current) {
      // We'll use the empty string to reset the session on the server
      chatServiceRef.current.setSessionId('');
    }
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Chat History - hidden by default on mobile and medium screens unless toggled */}
      <ChatHistory
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        isLargeScreen={isLargeScreen}
      />

      {/* Main Content */}
      <div className="flex-1 flex md:flex-row flex-col h-full overflow-hidden">
        {/* Chat Area */}
        <div 
          className={`md:flex-1 md:block ${
            isMobile ? (chatOpen ? 'block h-full' : 'hidden') : 'block h-full'
          }`}
        >
          <ChatArea
            messages={activeSession.messages}
            onSendMessage={handleSendMessage}
            onOpenHistory={() => setHistoryOpen(true)}
            showHistoryButton={!isLargeScreen}
            isLoading={isLoading}
          />
        </div>

        {/* App Area - Wallet info */}
        <div 
          className={`md:w-96 md:block ${
            isMobile ? (chatOpen ? 'hidden' : 'block h-full') : 'block'
          }`}
        >
          <AppArea
            walletInfo={mockWalletInfo}
            onOpenChat={() => setChatOpen(true)}
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
} 