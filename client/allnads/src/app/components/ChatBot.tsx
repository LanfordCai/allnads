"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatSession } from '../types/chat';
import ChatHistory from './ChatHistory';
import ChatArea from './ChatArea';
import WalletInfoComponent from './WalletInfo';
import { ChatService } from '../services/ChatService';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { useRouter } from 'next/navigation';
import { useIdentityToken } from '@privy-io/react-auth';
import { useChatWithNFT } from '../hooks/useChatWithNFT';
import { NFTAvatarDisplay } from './chat/NFTAvatarDisplay';
import { useChatSessions } from '../hooks/useChatSessions';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useNotification } from '../contexts/NotificationContext';
import { useTemplateOwnership } from '../hooks/useTemplateOwnership';
import { usePrivyTokens } from '../hooks/usePrivyTokens';
// Local storage key
const STORAGE_KEY = 'allnads_chat_sessions';

// Function to update session title
const updateSessionTitle = (session: ChatSession, content: string): string => {
  const shouldUpdateTitle = session.messages.length === 0 || session.title === 'New Chat';
  if (shouldUpdateTitle) {
    const newTitle = content.length > 30 ? content.substring(0, 27) + '...' : content;
    console.log(`Updating session title: "${session.title}" -> "${newTitle}"`);
    return newTitle;
  }
  return session.title;
};


export default function ChatBot() {
  // UI state management
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isMediumScreen, setIsMediumScreen] = useState(false);
  // Add modal state
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  // Add ChatHistory fullscreen state
  const [isHistoryFullscreen, setIsHistoryFullscreen] = useState(false);
  
  // Privy authentication
  const { privy, isAuthenticated, isReady, user } = usePrivyAuth();
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<'authenticated' | 'anonymous' | 'pending'>('pending');
  const [authError, setAuthError] = useState<string | null>(null);
  const { identityToken } = useIdentityToken();
  
  // Avatar image state
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  
  // 用于跟踪组件是否已经完成初始渲染
  const initialRenderRef = useRef<boolean>(false);
  
  // Chat service setup
  const chatServiceRef = useRef<ChatService | null>(null);
  
  // Replace getPrivyTokens with usePrivyTokens hook
  const { getTokens } = usePrivyTokens();
  
  // Initialize chat service
  useEffect(() => {
    if (!chatServiceRef.current) {
      console.log('Initializing chat service');
      chatServiceRef.current = new ChatService();
      
      // Set token provider function
      chatServiceRef.current.setTokenProvider(getTokens);
    }
  }, [getTokens]); // Add getTokens to dependency array
  
  // Clear authentication error
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
    deleteSession,
  } = useChatSessions(STORAGE_KEY, user?.wallet?.address || user?.id);

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
  
  // Use the template ownership hook to manage template ownership
  const { checkOwnership } = useTemplateOwnership();
  
  // Check template ownership when NFT account changes
  useEffect(() => {
    if (nftAccount) {
      checkOwnership(nftAccount);
    }
  }, [nftAccount, checkOwnership]);

  // Monitor Privy authentication status changes
  useEffect(() => {
    if (!isReady) return;
    
    const newAuthStatus = isAuthenticated ? 'authenticated' : 'anonymous';
    if (authStatus !== newAuthStatus) {
      console.log(`Privy authentication status change: ${authStatus} -> ${newAuthStatus}`);
      setAuthStatus(newAuthStatus);
      
      // When status changes from authenticated to anonymous, disconnect WebSocket
      if (newAuthStatus === 'anonymous' && chatServiceRef.current) {
        console.log('User logged out, disconnecting WebSocket');
        chatServiceRef.current.disconnect();
        setAuthError('You have logged out. Please log in again to continue chatting');
        return;
      }
      
      // If there is an active session and user is authenticated, connect WebSocket
      if (newAuthStatus === 'authenticated' && activeSessionId && chatServiceRef.current) {
        console.log('User authenticated, WebSocket will connect automatically after NFT info is loaded...');
        chatServiceRef.current.disconnect(); // Ensure any existing connection is disconnected first
        // No longer connect directly, but wait for NFT info to load before connecting
      }
    }
  }, [isReady, isAuthenticated, authStatus, activeSessionId]);

  // When activeSessionId changes, update ChatService session ID and reconnect
  useEffect(() => {
    if (chatServiceRef.current && activeSessionId) {
      console.log(`Switching to session ID: ${activeSessionId}`);
      
      // If user is not authenticated, don't connect WebSocket
      if (authStatus === 'anonymous') {
        console.log('User not authenticated, not connecting WebSocket');
        setAuthError('Please log in to use the chat feature');
        return;
      }
      
      // First set the session ID
      chatServiceRef.current.setSessionId(activeSessionId);
      
      // If WebSocket is already connected, disconnect first
      chatServiceRef.current.disconnect();
      
      // Check if NFT info is set
      if (isNftInfoSet) {
        // NFT info is set, connect WebSocket directly
        console.log('NFT info is set, connecting WebSocket directly...');
        chatServiceRef.current.connect()
          .then(() => {
            console.log('WebSocket connection successful');
          })
          .catch(error => {
            console.error('WebSocket connection failed:', error);
          });
      } else {
        // NFT info not set, wait for NFT info to load before connecting
        console.log('Waiting for NFT info to load before connecting WebSocket...');
      }
    }
  }, [activeSessionId, authStatus, isNftInfoSet]);

  // Mobile device responsive setup
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsMediumScreen(width >= 768 && width < 1024);
      
      if (width < 768) {
        setIsSidebarOpen(false);
      } else if (width >= 768 && width < 1024) {
        // On medium screens, sidebar is initially closed
        setIsSidebarOpen(false);
      } else {
        // On large screens, sidebar is always open
        setIsSidebarOpen(true);
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Use useCallback to optimize session switching logic
  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    if (isMobile || isMediumScreen) {
      // Use setTimeout to delay closing sidebar, avoiding layout sudden change
      setTimeout(() => {
        setIsSidebarOpen(false);
      }, 50);
    }
  }, [isMobile, isMediumScreen]);

  // Use useCallback to optimize sidebar switching logic
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Handle sending message
  const handleSendMessage = (content: string) => {
    if (!chatServiceRef.current) {
      console.error('Chat service not initialized');
      return;
    }
    
    // Check if user is authenticated
    if (authStatus !== 'authenticated') {
      console.log('User not authenticated, cannot send message');
      setAuthError('Please log in to send message');
      // No need to display error message as UI already displays login prompt
      return;
    }

    // Check if user has an NFT
    if (!nftAccount) {
      console.log('User does not have an NFT, cannot send message');
      showNotification('You need an NFT to send messages. Please get an NFT first.', 'error');
      return;
    }

    // Use ref to get latest sessionId
    const currentSessionId = activeSessionIdRef.current;
    console.log(`Sending message to session ID: ${currentSessionId}`, content.substring(0, 30));

    // Create and immediately add user message to UI
    const userMessage = chatServiceRef.current.createLocalMessage(content, 'user');
    
    // Set loading state
    // setIsLoading(true); // Now handled in the WebSocket hook
    
    // Update session
    setSessions((prevSessions: ChatSession[]) => {
      console.log(`Adding user message to session: ${currentSessionId}`, content.substring(0, 30));
      return prevSessions.map((session: ChatSession) => {
        if (session.id === currentSessionId) {
          // Set session title:
          // 1. If this is a new chat (no messages), directly use the first message as title
          // 2. Or if the current title is still "New Chat" default title, also use this message to update title
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

    // Get ChatService current used sessionId
    const currentServiceSessionId = chatServiceRef.current.getSessionId();
    console.log(`ChatService current session ID: ${currentServiceSessionId}, target session ID: ${currentSessionId}`);

    // Send message to server, using current session ID
    try {
      chatServiceRef.current.sendMessage(content, {
        sessionId: currentSessionId, // Use current active session ID
        enableTools: true
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Update UI to display error
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

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (sessions.length === 0) {
        createNewSession(isMobile || isMediumScreen, chatServiceRef.current, isNftInfoSet);
      }
    }
    
    if (!initialRenderRef.current) {
      initialRenderRef.current = true;
    }
  }, [isAuthenticated, isLoading, sessions.length, createNewSession, isMobile, isMediumScreen, isNftInfoSet]);

  // Get the notification context
  const { showNotification } = useNotification();

  // Create a wrapper function for createNewSession that checks for NFT
  const handleCreateNewSession = () => {
    if (!nftAccount) {
      showNotification('You need an NFT to create a new chat. Please get an NFT first.', 'error');
      return;
    }
    createNewSession(isMobile || isMediumScreen, chatServiceRef.current, isNftInfoSet);
  };

  // Create a wrapper function for handleSelectSession that checks for NFT
  const handleSelectSessionWithNFTCheck = (id: string) => {
    if (!nftAccount) {
      showNotification('You need an NFT to select a chat. Please get an NFT first.', 'error');
      return;
    }
    handleSelectSession(id);
  };

  // Create a wrapper function for deleteSession that checks for NFT
  const handleDeleteSession = (id: string) => {
    if (!nftAccount) {
      showNotification('You need an NFT to delete a chat. Please get an NFT first.', 'error');
      return;
    }
    deleteSession(id);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Overlay for mobile and medium screens when sidebar is open */}
      {(isMobile || isMediumScreen) && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[35]"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      
      {/* Chat modal - Displayed on small screens */}
      {isMobile && isChatModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[50] flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-50 z-[51] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
              {/* Left: Button to open ChatHistory */}
              <button 
                onClick={() => {
                  if (!nftAccount) {
                    showNotification('You need an NFT to view chat history. Please get an NFT first.', 'error');
                    return;
                  }
                  setIsHistoryFullscreen(true);
                }}
                className={`p-2 rounded-lg transition-colors focus:outline-none ${
                  !nftAccount ? 'bg-purple-200 text-purple-400 cursor-not-allowed' : 'hover:bg-[#F3F0FF] text-[#8B5CF6]'
                }`}
                disabled={!nftAccount}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#8B5CF6]"
                >
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              
              {/* Right: Close button */}
              <button 
                onClick={() => setIsChatModalOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {/* Modal content - ChatArea */}
            <div className="flex-1 overflow-hidden">
              <ChatArea
                messages={activeSession.messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                isMobile={isMobile}
                isMediumScreen={isMediumScreen}
                avatarImage={avatarImage}
                onAvatarImageChange={setAvatarImage}
                isInModal={true}
                nftAccount={nftAccount}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* ChatHistory fullscreen modal - Displayed on small screens */}
      {isMobile && isHistoryFullscreen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-white z-[61] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
              <h2 className="text-lg font-bold">Chat History</h2>
              
              {/* Right: Close button */}
              <button 
                onClick={() => setIsHistoryFullscreen(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {/* Modal content - ChatHistory */}
            <div className="flex-1 overflow-hidden">
              <ChatHistory
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={(sessionId) => {
                  handleSelectSessionWithNFTCheck(sessionId);
                  setIsHistoryFullscreen(false);
                }}
                onCreateSession={() => {
                  handleCreateNewSession();
                  setIsHistoryFullscreen(false);
                }}
                onDeleteSession={handleDeleteSession}
                onClose={() => setIsHistoryFullscreen(false)}
                isFullscreen={true}
                nftAccount={nftAccount}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out fixed top-0 left-0 md:fixed lg:relative z-[40] h-screen w-64 md:w-80 bg-white border-r border-gray-200 shadow-lg overflow-hidden`}
        style={{ height: '100%', maxHeight: '100vh' }}
      >
        <ChatHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSessionWithNFTCheck}
          onCreateSession={handleCreateNewSession}
          onDeleteSession={handleDeleteSession}
          onClose={() => setIsSidebarOpen(false)}
          nftAccount={nftAccount}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        {/* Chat area */}
        <div className={`${isMobile ? 'hidden' : 'flex-1'} h-full overflow-hidden flex flex-col mx-auto w-full`}>
          {authStatus === 'authenticated' ? (
            <ChatArea
              messages={activeSession.messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onToggleSidebar={handleToggleSidebar}
              isMobile={isMobile}
              isMediumScreen={isMediumScreen}
              isSidebarOpen={isSidebarOpen}
              avatarImage={avatarImage}
              onAvatarImageChange={setAvatarImage}
              nftAccount={nftAccount}
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
                <h2 className="text-xl font-semibold mb-2">Need to log in</h2>
                <p className="text-gray-600 mb-4">
                  {authError || 'Please log in to use the chat feature'}
                </p>
                <button
                  onClick={() => privy.login()}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Log in/Register
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Right column for wallet info on larger screens */}
        <div className="w-full md:w-96 md:flex-shrink-0 md:border-l border-gray-200 md:h-full h-screen overflow-y-auto p-4 bg-gray-50">
          {/* NFT Avatar Image */}
          <NFTAvatarDisplay 
            isLoadingAvatar={isLoadingNFT}
            avatarImage={avatarImage}
            nftError={nftHookError}
            nftName={null} // Will be fetched inside the component
            tokenId={tokenId}
            router={router}
            nftAccount={nftAccount}
            onAvatarImageChange={setAvatarImage}
            onSendMessage={handleSendMessage}
            isSmallScreen={isMobile}
            onSwitchToChat={() => {
              // Open chat modal on small screens
              if (isMobile) {
                setIsChatModalOpen(true);
              } else {
                // On large screens, scroll to chat area
                // Close the sidebar if it's open on mobile
                if (isMediumScreen && isSidebarOpen) {
                  setIsSidebarOpen(false);
                }
                
                // Scroll to the chat area
                const chatArea = document.querySelector('.chat-area-container');
                if (chatArea) {
                  chatArea.scrollIntoView({ behavior: 'smooth' });
                }
              }
            }}
          />
          
          <WalletInfoComponent nftAccount={nftAccount} onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
} 