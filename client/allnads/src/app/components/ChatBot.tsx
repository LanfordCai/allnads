"use client"

import { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatSession } from '../types/chat';
import ChatHistory from './ChatHistory';
import ChatArea from './ChatArea';
import WalletInfoComponent from './WalletInfo';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../services/ChatService';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { useRouter } from 'next/navigation';
import { useIdentityToken } from '@privy-io/react-auth';
import { useChatWithNFT } from '../hooks/useChatWithNFT';
import { NFTAvatarDisplay } from './chat/NFTAvatarDisplay';
import { AuthStatusPanel } from './chat/AuthStatusPanel';
import { useChatSessions } from '../hooks/useChatSessions';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
// Define Monad Testnet chain
const monadChain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC || 'https://rpc.testnet.monad.xyz/'] }
  }
};

// Contract address for AllNads
const ALLNADS_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as string;

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
  // Remove avatarImage and isLoadingAvatar props as we'll handle them internally
}

export default function ChatBot({}: ChatBotProps) {
  // UI state management
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // Privy authentication
  const { privy, isAuthenticated, isReady, user } = usePrivyAuth();
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<'authenticated' | 'anonymous' | 'pending'>('pending');
  const [authError, setAuthError] = useState<string | null>(null);
  const { identityToken } = useIdentityToken();
  
  // Avatar image state
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  
  // 添加调试日志，记录 avatarImage 的变化
  useEffect(() => {
    console.log('ChatBot: avatarImage 已更新:', avatarImage ? avatarImage.substring(0, 50) + '...' : null);
  }, [avatarImage]);
  
  // Chat service setup
  const chatServiceRef = useRef<ChatService | null>(null);
  
  // Initialize chat service
  useEffect(() => {
    if (!chatServiceRef.current) {
      console.log('初始化聊天服务');
      chatServiceRef.current = new ChatService();
      
      // 设置获取令牌的函数
      chatServiceRef.current.setTokenProvider(getPrivyTokens);
    }
  }, []);
  
  // 获取Privy访问令牌的函数
  const getPrivyTokens = async (): Promise<{ accessToken: string | null; identityToken: string | null }> => {
    if (!isAuthenticated) {
      return { accessToken: null, identityToken: null };
    }
    
    try {
      const accessToken = await privy.getAccessToken();
      return { accessToken, identityToken };
    } catch (error) {
      console.error('获取Privy访问令牌失败:', error);
      return { accessToken: null, identityToken: null };
    }
  };
  
  // 清除认证错误
  useEffect(() => {
    if (isAuthenticated) {
      setAuthError(null);
    }
  }, [isAuthenticated]);

  // Use custom hooks for session management and WebSocket handling
  const { 
    sessions, 
    setSessions, 
    activeSessionId, 
    setActiveSessionId, 
    activeSessionIdRef,
    activeSession,
    createNewSession,
    deleteSession
  } = useChatSessions(STORAGE_KEY);

  const {
    isLoading,
    setupChatEventHandlers
  } = useChatWebSocket(chatServiceRef, setSessions, activeSessionIdRef);

  // Set up event handlers when chat service is initialized
  useEffect(() => {
    if (chatServiceRef.current) {
      setupChatEventHandlers();
    }
  }, [setupChatEventHandlers]);

  // Use the NFT hook to automatically set NFT information in the chat service and connect
  const { 
    nftAccount, 
    tokenId, 
    isLoading: isLoadingNFT, 
    error: nftHookError, 
    isNftInfoSet 
  } = useChatWithNFT(chatServiceRef.current || new ChatService());

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
        console.log('用户已认证，NFT信息将在加载后自动连接WebSocket...');
        chatServiceRef.current.disconnect(); // 确保先断开任何现有连接
        // 不再直接连接，而是等待NFT信息加载后自动连接
      }
    }
  }, [isReady, isAuthenticated, authStatus, activeSessionId]);

  // 当activeSessionId变化时，更新ChatService的会话ID并重新连接
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
      
      // 如果WebSocket已连接，先断开
      chatServiceRef.current.disconnect();
      
      // 检查NFT信息是否已设置
      if (isNftInfoSet) {
        // NFT信息已设置，直接连接WebSocket
        console.log('NFT信息已设置，直接连接WebSocket...');
        chatServiceRef.current.connect()
          .then(() => {
            console.log('WebSocket连接成功');
          })
          .catch(error => {
            console.error('WebSocket连接失败:', error);
          });
      } else {
        // NFT信息未设置，等待NFT信息加载后自动连接
        console.log('等待NFT信息加载后自动连接WebSocket...');
      }
    }
  }, [activeSessionId, authStatus, isNftInfoSet]);

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
    // setIsLoading(true); // Now handled in the WebSocket hook
    
    // 更新会话
    setSessions((prevSessions: ChatSession[]) => {
      console.log(`添加用户消息到会话: ${currentSessionId}`, content.substring(0, 30));
      return prevSessions.map((session: ChatSession) => {
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
      
      setSessions((prevSessions: ChatSession[]) => prevSessions.map((session: ChatSession) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, errorMessage],
            lastActivity: new Date()
          };
        }
        return session;
      }));
    }
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
          onCreateSession={() => createNewSession(isMobile, chatServiceRef.current, isNftInfoSet)}
          onDeleteSession={deleteSession}
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
              avatarImage={avatarImage}
              onAvatarImageChange={setAvatarImage}
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
        <div className="w-full md:w-96 md:flex-shrink-0 md:border-l border-gray-200 md:h-full md:overflow-y-auto p-4 bg-gray-50">
          {/* NFT Avatar Image */}
          <NFTAvatarDisplay 
            isLoadingAvatar={isLoadingNFT}
            avatarImage={avatarImage}
            nftError={nftHookError}
            nftName={null} // Will be fetched inside the component
            tokenId={tokenId}
            isAuthenticated={isAuthenticated}
            user={user}
            router={router}
            nftAccount={nftAccount}
            onAvatarImageChange={setAvatarImage}
            onSendMessage={handleSendMessage}
          />
          
          <WalletInfoComponent nftAccount={nftAccount} />
          
          {/* 认证状态和登录按钮 */}
          <AuthStatusPanel 
            authStatus={authStatus}
            isAuthenticated={isAuthenticated}
            privy={privy}
          />
        </div>
      </div>
    </div>
  );
} 