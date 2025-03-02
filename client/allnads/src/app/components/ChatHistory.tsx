"use client"

import { useState } from 'react';
import { ChatSession } from '../types/chat';

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isLargeScreen: boolean;
}

export default function ChatHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  isOpen,
  onClose,
  isLargeScreen,
}: ChatHistoryProps) {
  return (
    <div 
      className={`fixed lg:relative top-0 left-0 z-30 h-full w-72 bg-white dark:bg-gray-900 shadow-lg transition-transform duration-300 ${
        isOpen || isLargeScreen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold">Chat History</h2>
        <button 
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden" 
          onClick={onClose}
          aria-label="Close chat history"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      <div className="overflow-y-auto h-[calc(100%-60px)]">
        {sessions.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    session.id === activeSessionId ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="font-medium truncate">{session.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {session.messages[session.messages.length - 1]?.content || 'No messages'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {session.lastActivity.toLocaleDateString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center text-gray-500 dark:text-gray-400">
            <p>No chat history</p>
            <p className="text-sm mt-2">Start a new chat to see it here</p>
          </div>
        )}
      </div>
    </div>
  );
} 