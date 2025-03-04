"use client"

import { useState, useEffect, useRef } from 'react';
import { ChatSession } from '../types/chat';

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
  isFullscreen?: boolean;
}

export default function ChatHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onClose,
  isFullscreen = false,
}: ChatHistoryProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(80); // 默认高度

  // 测量标题栏高度
  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []);

  // 格式化时间的辅助函数
  const formatTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    
    // 如果是今天的消息，只显示时间
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // 如果是昨天的消息
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return '昨天';
    }
    
    // 如果是今年的消息
    if (messageDate.getFullYear() === now.getFullYear()) {
      return messageDate.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
    }
    
    // 其他情况显示完整日期
    return messageDate.toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' });
  };

  return (
    <div className={`flex flex-col h-full bg-white ${isFullscreen ? 'w-full' : ''}`}>
      <div 
        ref={headerRef}
        className={`flex items-center justify-between p-4 ${!isFullscreen ? 'border-b-4 border-[#8B5CF6]' : 'border-b border-gray-200'} bg-white sticky top-0 z-[5]`}
      >
        <h2 className="text-xl font-bold text-[#5B21B6]">Chats</h2>
        <div className="flex space-x-2">
          <button
            onClick={onCreateSession}
            className="py-2 px-4 bg-[#8B5CF6] text-white font-bold uppercase rounded-xl border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6] transition-all"
            aria-label="New chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          
          {!isFullscreen && (
            <button
              onClick={onClose}
              className="md:hidden py-2 px-4 bg-gray-200 text-gray-700 font-bold uppercase rounded-xl border-4 border-gray-300 shadow-[4px_4px_0px_0px_#9CA3AF] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#9CA3AF] transition-all"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-[#C4B5FD] scrollbar-track-gray-100 hover:scrollbar-thumb-[#A78BFA]"
        style={{ maxHeight: `calc(100vh - ${headerHeight}px)` }}
      >
        {sessions.length === 0 ? (
          <div className="text-center text-[#6D28D9] py-8 border-2 border-dashed border-[#C4B5FD] rounded-xl p-6">
            <p className="font-bold">No chats yet</p>
            <p className="mt-2">Create a new chat to get started</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
                session.id === activeSessionId
                  ? 'border-[#8B5CF6]'
                  : 'hover:bg-[#F9F7FF] border-[#C4B5FD] hover:border-[#A78BFA]'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="truncate flex-1">
                  <div className={`font-bold truncate ${
                    session.id === activeSessionId 
                      ? 'text-[#5B21B6]' 
                      : 'text-[#A78BFA]'
                  }`}>
                    {session.title || 'New Chat'}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className={`text-sm truncate ${
                      session.id === activeSessionId 
                        ? 'text-[#7C3AED]' 
                        : 'text-[#C4B5FD]'
                    }`}>
                      {session.messages.length > 0
                        ? `${session.messages.length} message${session.messages.length === 1 ? '' : 's'}`
                        : 'No messages yet'}
                    </div>
                    <div className={`text-xs ml-2 ${
                      session.id === activeSessionId 
                        ? 'text-[#7C3AED]' 
                        : 'text-[#C4B5FD]'
                    }`}>
                      {session.lastActivity && formatTime(session.lastActivity)}
                    </div>
                  </div>
                </div>
                {session.id === activeSessionId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-[#EDE9FE] text-[#8B5CF6] hover:text-[#6D28D9] border border-[#C4B5FD] ml-2"
                    aria-label="Delete chat"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 