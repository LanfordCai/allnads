"use client"

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/chat';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
  isSidebarOpen?: boolean;
  avatarImage?: string | null;
}

export default function ChatArea({ 
  messages, 
  onSendMessage, 
  isLoading = false,
  onToggleSidebar,
  isMobile = false,
  isSidebarOpen = true,
  avatarImage = null
}: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (trimmedMessage) {
      onSendMessage(trimmedMessage);
      setNewMessage('');
    }
  };

  // 渲染消息内容，支持换行和工具调用格式
  const renderMessageContent = (message: ChatMessage) => {
    // 先对整个消息内容进行trim处理
    const trimmedContent = message.content.trim();
    
    // 如果是工具类消息，格式化显示
    if (message.role === 'tool') {
      // 分割消息内容，提取工具信息
      const parts = trimmedContent.split('\n\n');
      if (parts.length >= 2) {
        const [description, ...details] = parts;
        
        return (
          <>
            <div className="text-xs text-gray-500 mb-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              Calling MCP tool
              <span className="ml-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-1">{details[0]?.split(': ')[1]?.split('\n')[0]}</span>
            </div>
            <div className="text-xs font-mono overflow-x-auto">
              {details.slice(1).map((detail, i) => (
                <div key={i} className="text-gray-600 dark:text-gray-400">{detail}</div>
              ))}
            </div>
          </>
        );
      }
    }
    
    // 如果是交易签名消息，特殊格式化显示
    if (message.role === 'transaction_to_sign') {
      // 分割消息内容，提取交易信息
      const parts = trimmedContent.split('\n\n');
      if (parts.length >= 2) {
        const mainContent = parts[0];
        const transactionInfo = parts.slice(1).join('\n\n');
        
        return (
          <>
            <div className="mb-2">{mainContent}</div>
            <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded border border-blue-200 dark:border-blue-700 overflow-x-auto">
              <div className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                {transactionInfo.split('\n')[0]}
              </div>
              <div className="font-mono text-sm">
                {transactionInfo.split('\n').slice(1).map((line, i) => (
                  <div key={i} className="mb-1">
                    <span className="font-medium">{line.split(': ')[0]}: </span>
                    <span className="break-all">{line.split(': ')[1]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors">
                  签名交易
                </button>
              </div>
            </div>
          </>
        );
      }
    }
    
    // 处理正常文本（支持换行）
    return trimmedContent.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < trimmedContent.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  // 获取消息的样式类
  const getMessageClasses = (message: ChatMessage) => {
    const baseClasses = "max-w-[80%] rounded-lg p-2 ";
    
    switch (message.role) {
      case 'user':
        return `${baseClasses} bg-blue-500 text-white rounded-br-none ml-auto`;
      case 'bot':
        return `${baseClasses} bg-gray-200 dark:bg-gray-700 rounded-bl-none`;
      case 'thinking':
        return `${baseClasses} bg-gray-200 dark:bg-gray-700 rounded-bl-none animate-pulse`;
      case 'system':
        return `${baseClasses} bg-yellow-100 dark:bg-yellow-800 text-center italic mx-auto`;
      case 'tool':
        return `${baseClasses} bg-gray-100 dark:bg-gray-800 rounded-bl-none border border-gray-200 dark:border-gray-700`;
      case 'transaction_to_sign':
        return `${baseClasses} bg-white dark:bg-gray-800 rounded-bl-none border border-blue-300 dark:border-blue-700`;
      case 'error':
        return `${baseClasses} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200`;
      default:
        return baseClasses;
    }
  };

  // 获取消息的时间戳样式
  const getTimestampClasses = (message: ChatMessage) => {
    const baseClasses = "text-xs mt-1 ";
    
    switch (message.role) {
      case 'user':
        return `${baseClasses} text-blue-100 text-right`;
      case 'system':
      case 'error':
        return `${baseClasses} text-gray-500 text-center`;
      default:
        return `${baseClasses} text-gray-500 dark:text-gray-400`;
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-3 border-b border-gray-200">
        {isMobile && (
          <button 
            onClick={onToggleSidebar} 
            className="mr-2 p-1 rounded-md hover:bg-gray-100 transition-colors focus:outline-none"
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
              className={`${isSidebarOpen ? 'transform rotate-90' : ''}`}
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        <h2 className="text-lg font-medium">Chat with AllNads</h2>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message, index) => {
          // Check if this is the first AI message in a sequence
          const isFirstInSequence = () => {
            // If it's not an AI message (bot, tool, error, thinking, transaction_to_sign), no need to check
            if (!['bot', 'tool', 'error', 'thinking', 'transaction_to_sign'].includes(message.role)) {
              return false;
            }
            
            // If it's the first message overall, it's the first in sequence
            if (index === 0) {
              return true;
            }
            
            // Check if the previous message was from a different sender (not AI)
            const prevMessage = messages[index - 1];
            return !['bot', 'tool', 'error', 'thinking', 'transaction_to_sign'].includes(prevMessage.role);
          };
          
          // Determine if we should show the avatar
          const shouldShowAvatar = isFirstInSequence();
          
          return (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'}`}
            >
              {(message.role === 'bot' || message.role === 'tool' || message.role === 'error' || message.role === 'thinking' || message.role === 'transaction_to_sign') && shouldShowAvatar && (
                <div className="w-12 h-12 rounded-[8px] overflow-hidden mr-2 flex-shrink-0">
                  <img 
                    src={avatarImage || "https://picsum.photos/500/500"} 
                    alt="AI Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails to load
                      e.currentTarget.src = "https://picsum.photos/500/500";
                    }}
                  />
                </div>
              )}
              {/* Add empty space to maintain alignment when avatar is not shown */}
              {(message.role === 'bot' || message.role === 'tool' || message.role === 'error' || message.role === 'thinking' || message.role === 'transaction_to_sign') && !shouldShowAvatar && (
                <div className="w-12 mr-2 flex-shrink-0"></div>
              )}
              <div className={getMessageClasses(message)}>
                <div className="break-words">{renderMessageContent(message)}</div>
                <div className={getTimestampClasses(message)}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            {/* Only show avatar if last message was not from AI */}
            {(messages.length === 0 || !['bot', 'tool', 'error', 'thinking', 'transaction_to_sign'].includes(messages[messages.length - 1].role)) && (
              <div className="w-8 h-8 overflow-hidden mr-2 flex-shrink-0">
                <img 
                  src={avatarImage || "https://picsum.photos/500/500"} 
                  alt="AI Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {/* Add empty space to maintain alignment when avatar is not shown */}
            {messages.length > 0 && ['bot', 'tool', 'error', 'thinking', 'transaction_to_sign'].includes(messages[messages.length - 1].role) && (
              <div className="w-12 mr-2 flex-shrink-0"></div>
            )}
            <div className="max-w-[80%] rounded-lg p-2 bg-gray-200 dark:bg-gray-700 rounded-bl-none">
              <div className="flex space-x-2 items-center">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300"
            disabled={!newMessage.trim() || isLoading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );

  function formatTime(date: Date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
} 