"use client"

import { useState, useEffect } from 'react';
import { ChatMessage, ChatSession, WalletInfo } from '../types/chat';
import ChatHistory from './ChatHistory';
import ChatArea from './ChatArea';
import AppArea from './AppArea';
import { v4 as uuidv4 } from 'uuid';

// Mock data for demo
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

  // Screen size states
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768); // Mobile: < md breakpoint
      setIsLargeScreen(window.innerWidth >= 1024); // Large: >= lg breakpoint
    };

    // Initial check
    checkScreenSize();

    // Add event listener for window resize
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Get active session
  const activeSession = sessions.find(session => session.id === activeSessionId) || initialSession;

  // Handle sending a message
  const handleSendMessage = (content: string) => {
    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content,
      sender: 'user',
      timestamp: new Date(),
    };

    // Mock bot response 
    const botMessage: ChatMessage = {
      id: uuidv4(),
      content: `This is a mock response to: "${content}"`,
      sender: 'bot',
      timestamp: new Date(Date.now() + 500),
    };

    // Update session
    const updatedSessions = sessions.map(session => {
      if (session.id === activeSessionId) {
        return {
          ...session,
          messages: [...session.messages, userMessage, botMessage],
          lastActivity: new Date(),
          title: content.length > 30 ? content.substring(0, 27) + '...' : content,
        };
      }
      return session;
    });

    setSessions(updatedSessions);
  };

  // Select a chat session
  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (!isLargeScreen) {
      setHistoryOpen(false);
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