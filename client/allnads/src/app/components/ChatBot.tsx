"use client"

import { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatSession, WalletInfo } from '../types/chat';
import ChatHistory from './ChatHistory';
import ChatArea from './ChatArea';
import WalletInfoComponent from './WalletInfo';
import ImageCard from './ImageCard';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../services/ChatService';
import { usePrivyAuth } from '../hooks/usePrivyAuth';

// Mock wallet info for now (this could come from another API in a real app)
const mockWalletInfo: WalletInfo = {
  balance: '0.00',
  username: 'lanford_33',
  avatarUrl: '/avatar.png',
};

// 本地存储键
const STORAGE_KEY = 'allnads_chat_sessions';

// 创建初始会话
const createInitialSession = (): ChatSession => ({
  id: uuidv4(),
  title: 'New Chat',
  messages: [],
  lastActivity: new Date(),
});

// 更新会话标题的函数
const updateSessionTitle = (session: ChatSession, content: string): string => {
  const shouldUpdateTitle = session.messages.length === 0 || session.title === 'New Chat';
  if (shouldUpdateTitle) {
    const newTitle = content.length > 30 ? content.substring(0, 27) + '...' : content;
    console.log(`更新会话标题: "${session.title}" -> "${newTitle}"`);
    return newTitle;
  }
  return session.title;
};

// 添加接口定义
interface ChatBotProps {
  avatarImage?: string | null;
  isLoadingAvatar?: boolean;
}

export default function ChatBot({ avatarImage, isLoadingAvatar = false }: ChatBotProps) {
  // Session management
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  
  // 使用ref追踪当前活跃的会话ID，解决闭包问题
  const activeSessionIdRef = useRef<string>('');
  
  // 添加一个引用来标记初始加载是否完成
  const initialLoadCompleted = useRef<boolean>(false);
  
  // UI state management
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Chat service setup
  const chatServiceRef = useRef<ChatService | null>(null);

  // Mobile responsiveness
  const [isMobile, setIsMobile] = useState(false);
  
  // Privy authentication
  const { privy, isAuthenticated, isReady } = usePrivyAuth();
  const [authStatus, setAuthStatus] = useState<'authenticated' | 'anonymous' | 'pending'>('pending');
  
  // 显示认证错误
  const [authError, setAuthError] = useState<string | null>(null);
  
  // 获取Privy访问令牌的函数
  const getAccessToken = async (): Promise<string | null> => {
    if (!isAuthenticated) {
      console.log('用户未认证，返回null令牌');
      return null;
    }
    
    try {
      // 使用privy.getAccessToken()方法获取令牌
      const token = await privy.getAccessToken();
      console.log('成功获取Privy访问令牌');
      return token;
    } catch (error) {
      console.error('获取Privy访问令牌失败:', error);
      return null;
    }
  };
  
  // 清除认证错误
  useEffect(() => {
    if (isAuthenticated) {
      setAuthError(null);
    }
  }, [isAuthenticated]);

  // 从本地存储加载会话
  useEffect(() => {
    // 延迟加载，确保组件已完全挂载
    const timer = setTimeout(() => {
      console.log('开始延迟加载会话...');
      loadSessions();
    }, 100);
    
    const loadSessions = () => {
      try {
        console.log('尝试从本地存储加载会话...');
        const savedSessions = localStorage.getItem(STORAGE_KEY);
        console.log('从localStorage读取的原始数据:', savedSessions);
        
        // 先检查localStorage中是否已有sessionId和activeSessionId标记
        const lastActiveId = localStorage.getItem('allnads_active_session_id');
        if (lastActiveId) {
          console.log('找到上次活跃的会话ID:', lastActiveId);
        }
        
        if (savedSessions && savedSessions.length > 2) {  // 确保不只是"[]"
          let parsedSessions;
          try {
            parsedSessions = JSON.parse(savedSessions) as ChatSession[];
            
            // 验证解析的数据是否为数组
            if (!Array.isArray(parsedSessions)) {
              console.error('解析的数据不是数组:', parsedSessions);
              throw new Error('数据格式错误: 不是数组');
            }
            
            console.log('解析后的会话数据:', parsedSessions);
          } catch (parseError) {
            console.error('JSON解析错误:', parseError);
            throw new Error('无法解析会话数据');
          }
          
          // 如果保存的是空数组，则创建一个新会话
          if (parsedSessions.length === 0) {
            console.log('保存的是空数组，创建新会话');
            const newSession = createInitialSession();
            
            // 使用函数式更新确保状态立即更新
            setSessions(() => {
              initialLoadCompleted.current = true; // 标记初始加载完成
              return [newSession];
            });
            
            setActiveSessionId(newSession.id);
            
            // 保存当前活跃会话ID
            localStorage.setItem('allnads_active_session_id', newSession.id);
            return;
          }
          
          // 验证每个会话对象的完整性
          const validSessions = parsedSessions.filter(session => {
            if (!session || !session.id || !session.title || !Array.isArray(session.messages)) {
              console.error('发现无效会话:', session);
              return false;
            }
            return true;
          });
          
          if (validSessions.length === 0) {
            console.log('没有有效的会话数据，创建新会话');
            const newSession = createInitialSession();
            
            // 使用函数式更新确保状态立即更新
            setSessions(() => {
              initialLoadCompleted.current = true; // 标记初始加载完成
              return [newSession];
            });
            
            setActiveSessionId(newSession.id);
            
            // 保存当前活跃会话ID
            localStorage.setItem('allnads_active_session_id', newSession.id);
            return;
          }
          
          // 确保日期对象正确恢复
          const processedSessions = validSessions.map(session => ({
            ...session,
            lastActivity: new Date(session.lastActivity),
            messages: session.messages.map(msg => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
          
          console.log('处理后的会话数据:', processedSessions);
          
          // 使用函数式更新确保状态立即更新
          setSessions(() => {
            console.log('设置会话状态, 会话数量:', processedSessions.length);
            initialLoadCompleted.current = true; // 标记初始加载完成
            return processedSessions;
          });
          
          // 设置最近活跃的会话为当前会话
          if (processedSessions.length > 0) {
            // 按最近活动时间排序
            const sortedSessions = [...processedSessions].sort(
              (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
            );
            const newActiveId = lastActiveId && processedSessions.some(s => s.id === lastActiveId) 
              ? lastActiveId 
              : sortedSessions[0].id;
              
            setActiveSessionId(newActiveId);
            console.log('设置活跃会话ID:', newActiveId);
            
            // 保存当前活跃会话ID
            localStorage.setItem('allnads_active_session_id', newActiveId);
          }
        } else {
          // 没有保存的会话或者只是空数组，创建一个新会话
          console.log('localStorage中没有有效会话数据，创建新会话');
          const newSession = createInitialSession();
          
          // 使用函数式更新确保状态立即更新
          setSessions(() => {
            initialLoadCompleted.current = true; // 标记初始加载完成
            return [newSession];
          });
          
          setActiveSessionId(newSession.id);
          
          // 保存当前活跃会话ID
          localStorage.setItem('allnads_active_session_id', newSession.id);
        }
      } catch (error) {
        console.error('加载会话错误:', error);
        // 出错时创建一个新会话
        const newSession = createInitialSession();
        
        // 使用函数式更新确保状态立即更新
        setSessions(() => {
          initialLoadCompleted.current = true; // 错误处理也标记初始加载完成
          return [newSession];
        });
        
        setActiveSessionId(newSession.id);
        
        // 保存当前活跃会话ID
        localStorage.setItem('allnads_active_session_id', newSession.id);
      }
    };

    // 清理定时器
    return () => clearTimeout(timer);
  }, []);

  // 保存会话到本地存储
  useEffect(() => {
    // 如果初始加载还没完成，不要保存
    if (!initialLoadCompleted.current) {
      console.log('初始加载未完成，跳过保存到localStorage');
      return;
    }
    
    try {
      // 再次检查sessions长度
      console.log('保存会话到本地存储, 当前会话数量:', sessions.length, '会话详情:', JSON.stringify(sessions, (key, value) => {
        // 缩短消息内容以便于日志阅读
        if (key === 'content' && typeof value === 'string' && value.length > 30) {
          return value.substring(0, 30) + '...';
        }
        return value;
      }, 2).substring(0, 300) + '...');
      
      if (sessions.length === 0) {
        console.log('警告: 尝试保存空会话数组。这可能表示状态未正确更新。');
        // 验证是否真的应该保存空数组，或者这是一个异步状态问题
        if (localStorage.getItem(STORAGE_KEY) && localStorage.getItem(STORAGE_KEY) !== '[]') {
          console.log('localStorage中已有数据但当前状态为空，跳过保存以防止数据丢失');
          return;
        }
        console.log('保存空会话数组到localStorage');
        localStorage.setItem(STORAGE_KEY, '[]');
        return;
      }
      
      // 无论是否有会话，都保存到本地存储
      // 这样当用户删除所有会话时，空数组会被保存，防止旧数据在刷新后重新出现
      const sessionsToSave = sessions.map(session => {
        // 保存前验证会话结构完整性
        if (!session || !session.id) {
          console.error('发现无效会话对象:', session);
          return null;
        }
        
        return {
          ...session,
          // 保持lastActivity和message的timestamp为字符串，避免序列化问题
          lastActivity: session.lastActivity.toISOString(),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          }))
        };
      }).filter(Boolean); // 过滤掉无效的会话
      
      console.log('即将保存的会话数据:', sessionsToSave);
      const jsonData = JSON.stringify(sessionsToSave);
      console.log('保存的JSON数据长度:', jsonData.length);
      console.log('保存的JSON数据:', jsonData.substring(0, 100) + (jsonData.length > 100 ? '...' : ''));
      
      localStorage.setItem(STORAGE_KEY, jsonData);
      
      // 验证保存
      const savedData = localStorage.getItem(STORAGE_KEY);
      console.log('验证保存是否成功:', !!savedData, '数据长度:', savedData?.length);
    } catch (error) {
      console.error('保存会话到本地存储失败:', error);
    }
  }, [sessions]);

  // 获取当前活跃会话
  const activeSession = sessions.find(session => session.id === activeSessionId) || 
    (sessions.length > 0 ? sessions[0] : createInitialSession());

  // 当activeSessionId为空但sessions不为空时，自动设置activeSessionId为第一个会话
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      console.log('自动设置activeSessionId为第一个会话:', sessions[0].id);
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  // 移动设备响应式设置
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 当activeSessionId变化时更新ref
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    console.log(`activeSessionId更新为: ${activeSessionId}, ref更新为: ${activeSessionIdRef.current}`);
    
    // 当activeSessionId变化时也更新localStorage中的记录
    if (activeSessionId) {
      localStorage.setItem('allnads_active_session_id', activeSessionId);
      console.log('更新localStorage中的活跃会话ID:', activeSessionId);
    }
  }, [activeSessionId]);

  // 初始化聊天服务并设置事件处理程序
  useEffect(() => {
    const chatService = new ChatService();
    chatServiceRef.current = chatService;

    // 设置认证令牌提供者
    chatService.setTokenProvider(getAccessToken);
    console.log('已设置认证令牌提供者');
    
    // 监听Privy认证状态变化
    if (isReady) {
      setAuthStatus(isAuthenticated ? 'authenticated' : 'anonymous');
      console.log(`Privy认证状态: ${isAuthenticated ? '已认证' : '匿名'}`);
    }

    // 不再自动连接，而是等待activeSessionId设置后再连接
    // 事件处理程序的设置仍然在这里完成
    chatService
      .on('connected', (message) => {
        // 连接成功消息
        if (message.content) {
          const connectedMessage = chatService.createLocalMessage(message.content, 'system');
          
          setSessions(prevSessions => {
            // 使用ref获取最新的sessionId
            const currentSessionId = activeSessionIdRef.current;
            console.log(`Connected message received, updating session: ${currentSessionId}`);
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
        
        // 可以在这里触发重新认证
        setAuthStatus('anonymous');
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
          // 格式化工具调用消息
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
            
            // 不再在UI上显示会话ID变更的消息
          }
        }
      });

    // 不再自动连接，而是等待activeSessionId设置好后再连接

    // Clean up on unmount
    return () => {
      chatService.disconnect();
    };
  }, []); // 仅在组件挂载时初始化

  // 监听Privy认证状态变化
  useEffect(() => {
    if (!isReady) return;
    
    const newAuthStatus = isAuthenticated ? 'authenticated' : 'anonymous';
    if (authStatus !== newAuthStatus) {
      console.log(`Privy认证状态变化: ${authStatus} -> ${newAuthStatus}`);
      setAuthStatus(newAuthStatus);
      
      // 当状态从已认证变为匿名时，断开WebSocket连接
      if (newAuthStatus === 'anonymous' && chatServiceRef.current) {
        console.log('用户退出登录，断开WebSocket连接');
        chatServiceRef.current.disconnect();
        setAuthError('您已退出登录，请重新登录以继续聊天');
        return;
      }
      
      // 如果已经有活跃会话，且用户已认证，则连接WebSocket
      if (newAuthStatus === 'authenticated' && activeSessionId && chatServiceRef.current) {
        console.log('用户已认证，连接WebSocket...');
        chatServiceRef.current.disconnect(); // 确保先断开任何现有连接
        chatServiceRef.current.connect().catch(error => {
          console.error('连接WebSocket失败:', error);
          if (error.message && error.message.includes('Authentication required')) {
            setAuthError(error.message);
          }
        });
      }
    }
  }, [isReady, isAuthenticated, authStatus, activeSessionId]);

  // 当活跃会话ID变化时，更新ChatService的会话ID并重新连接
  useEffect(() => {
    if (chatServiceRef.current && activeSessionId) {
      console.log(`切换到会话 ID: ${activeSessionId}`);
      
      // 如果用户未认证，则不连接WebSocket
      if (authStatus === 'anonymous') {
        console.log('用户未认证，不连接WebSocket');
        setAuthError('请登录以使用聊天功能');
        return;
      }
      
      // 先设置会话ID
      chatServiceRef.current.setSessionId(activeSessionId);
      
      // 如果WebSocket已连接，先断开再重新连接以传递新的会话ID
      chatServiceRef.current.disconnect();
      
      // 重新连接，这次会带上新的会话ID
      chatServiceRef.current.connect().catch(error => {
        console.error('重新连接WebSocket失败:', error);
        
        // 检查是否是认证错误
        if (error.message && error.message.includes('Authentication required')) {
          setAuthError(error.message);
          return;
        }
        
        const errorMessage = chatServiceRef.current?.createLocalMessage(
          '重新连接聊天服务器失败，请刷新页面再试。', 
          'error'
        );
        
        if (errorMessage) {
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
        }
      });
    }
  }, [activeSessionId, authStatus]);

  // 处理发送消息
  const handleSendMessage = (content: string) => {
    if (!chatServiceRef.current) {
      console.error('Chat service not initialized');
      return;
    }
    
    // 检查用户是否已认证
    if (authStatus !== 'authenticated') {
      console.log('用户未认证，不能发送消息');
      setAuthError('请登录以发送消息');
      // 不需要显示错误消息，因为UI已经显示了登录提示
      return;
    }

    // 使用ref获取最新的sessionId
    const currentSessionId = activeSessionIdRef.current;
    console.log(`发送消息到会话 ID: ${currentSessionId}`, content.substring(0, 30));

    // 创建并立即添加用户消息到UI
    const userMessage = chatServiceRef.current.createLocalMessage(content, 'user');
    
    // 设置加载状态
    setIsLoading(true);
    
    // 更新会话
    setSessions(prevSessions => {
      console.log(`添加用户消息到会话: ${currentSessionId}`, content.substring(0, 30));
      return prevSessions.map(session => {
        if (session.id === currentSessionId) {
          // 设置会话标题：
          // 1. 如果这是新聊天（没有消息），直接用第一条消息作为标题
          // 2. 或者如果当前标题仍然是"New Chat"默认标题，也用这条消息更新标题
          const title = updateSessionTitle(session, content);
          
          return {
            ...session,
            title,
            messages: [...session.messages, userMessage],
            lastActivity: new Date()
          };
        }
        return session;
      });
    });

    // 获取ChatService当前使用的sessionId
    const currentServiceSessionId = chatServiceRef.current.getSessionId();
    console.log(`ChatService当前会话ID: ${currentServiceSessionId}, 目标会话ID: ${currentSessionId}`);

    // 发送消息到服务器，使用当前会话ID
    try {
      chatServiceRef.current.sendMessage(content, {
        sessionId: currentSessionId, // 使用当前活跃的会话ID
        enableTools: true
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // 更新UI显示错误
      const errorMessage = chatServiceRef.current.createLocalMessage(
        'Failed to send message. Please check your connection.', 
        'bot'
      );
      
      setSessions(prevSessions => prevSessions.map(session => {
        if (session.id === currentSessionId) {
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

  // Function to render the avatar image (if available)
  const renderAvatarImage = () => {
    if (isLoadingAvatar) {
      return (
        <div className="mx-auto text-center mt-4 mb-6">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Loading your NFT...</p>
        </div>
      );
    }
    
    if (avatarImage) {
      return (
        <div className="mx-auto max-w-xs mt-4 mb-6">
          <ImageCard 
            imageUrl={avatarImage} 
            alt="Your AllNads Avatar"
            title="Your AllNads NFT"
          />
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 transition-transform duration-300 ease-in-out absolute md:relative z-10 md:z-auto h-full w-64 md:w-80 bg-white border-r border-gray-200 md:block`}
      >
        <ChatHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            setActiveSessionId(id);
            if (isMobile) {
              setIsSidebarOpen(false);
            }
          }}
          onCreateSession={() => {
            const newSession = createInitialSession();
            console.log(`创建新会话: ID=${newSession.id}, 初始标题="${newSession.title}"`);
            
            setSessions(prevSessions => [...prevSessions, newSession]);
            setActiveSessionId(newSession.id);
          }}
          onDeleteSession={(id) => {
            const filteredSessions = sessions.filter(session => session.id !== id);
            
            // 如果删除的是当前活跃会话
            if (id === activeSessionId) {
              if (filteredSessions.length > 0) {
                // 如果还有其他会话，选择第一个作为活跃会话
                const newActiveId = filteredSessions[0].id;
                setActiveSessionId(newActiveId);
                
                // 更新localStorage中的活跃会话ID
                localStorage.setItem('allnads_active_session_id', newActiveId);
                console.log('删除会话后，更新活跃会话ID为:', newActiveId);
              } else {
                // 如果没有会话了，先清除activeSessionId，然后创建一个新会话
                setActiveSessionId('');
                localStorage.removeItem('allnads_active_session_id');
                
                // 创建新会话
                const newSession = createInitialSession();
                filteredSessions.push(newSession); // 添加到过滤后的数组中
                
                // 设置为活跃会话（异步执行，在下一个渲染周期）
                setTimeout(() => {
                  setActiveSessionId(newSession.id);
                  // 新会话ID会在activeSessionId的useEffect中被保存到localStorage
                }, 0);
              }
            }
            
            // 更新会话列表
            setSessions(filteredSessions);
          }}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 h-full overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
          {authStatus === 'authenticated' ? (
            <ChatArea
              messages={activeSession.messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              isMobile={isMobile}
              isSidebarOpen={isSidebarOpen}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
                <svg 
                  className="w-12 h-12 text-yellow-500 mx-auto mb-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M12 15v2m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <h2 className="text-xl font-semibold mb-2">需要登录</h2>
                <p className="text-gray-600 mb-4">
                  {authError || '请登录以使用聊天功能'}
                </p>
                <button
                  onClick={() => privy.login()}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  登录/注册
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Right column for wallet info on larger screens */}
        <div className="w-full md:w-80 md:flex-shrink-0 md:border-l border-gray-200 md:h-full md:overflow-y-auto p-4 bg-gray-50">
          {/* NFT Avatar Image */}
          {renderAvatarImage()}
          
          <WalletInfoComponent />
          
          {/* 认证状态和登录按钮 */}
          <div className="mt-4 p-4 bg-white rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-medium">认证状态</h3>
              <span className={`px-2 py-1 text-xs rounded-full ${
                authStatus === 'authenticated' 
                  ? 'bg-green-100 text-green-800' 
                  : authStatus === 'anonymous' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-gray-100 text-gray-800'
              }`}>
                {authStatus === 'authenticated' 
                  ? '已认证' 
                  : authStatus === 'anonymous' 
                    ? '匿名' 
                    : '加载中'}
              </span>
            </div>
            
            {authStatus === 'authenticated' ? (
              <button
                onClick={() => privy.logout()}
                className="w-full py-2 px-4 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                退出登录
              </button>
            ) : (
              <button
                onClick={() => privy.login()}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                登录/注册
              </button>
            )}
            
            {isAuthenticated && (
              <div className="mt-3 text-xs text-gray-500">
                <p>登录后，你的聊天记录可以在不同设备间同步，并且不会丢失。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 