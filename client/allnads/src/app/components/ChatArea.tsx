"use client"

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/chat';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onOpenHistory: () => void;
  showHistoryButton: boolean;
  isLoading?: boolean;
}

export default function ChatArea({ 
  messages, 
  onSendMessage, 
  onOpenHistory,
  showHistoryButton,
  isLoading = false
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
    if (message.sender === 'tool') {
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
    
    switch (message.sender) {
      case 'user':
        return `${baseClasses} bg-blue-500 text-white rounded-br-none`;
      case 'bot':
        return `${baseClasses} bg-gray-200 dark:bg-gray-700 rounded-bl-none`;
      case 'thinking':
        return `${baseClasses} bg-gray-200 dark:bg-gray-700 rounded-bl-none animate-pulse`;
      case 'system':
        return `${baseClasses} bg-yellow-100 dark:bg-yellow-800 text-center italic`;
      case 'tool':
        return `${baseClasses} bg-gray-100 dark:bg-gray-800 rounded-bl-none border border-gray-200 dark:border-gray-700`;
      case 'error':
        return `${baseClasses} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200`;
      default:
        return baseClasses;
    }
  };

  // 获取消息的时间戳样式
  const getTimestampClasses = (message: ChatMessage) => {
    const baseClasses = "text-xs mt-1 ";
    
    switch (message.sender) {
      case 'user':
        return `${baseClasses} text-blue-100`;
      case 'system':
      case 'error':
        return `${baseClasses} text-gray-500`;
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
      {/* Header - 减小标题栏高度和内边距 */}
      <div className="flex items-center justify-between py-2 px-3 border-b border-gray-200 dark:border-gray-700">
        {showHistoryButton && (
          <button 
            onClick={onOpenHistory}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Open chat history"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        <h1 className={`text-lg font-semibold ${showHistoryButton ? 'mx-auto' : ''}`}>Chat</h1>
        <div className="w-10"></div> {/* Spacer for alignment */}
      </div>

      {/* Messages - 减小消息区域内边距和间距 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length > 0 ? (
          <>
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex ${message.sender === 'user' ? 'justify-end' : message.sender === 'system' ? 'justify-center' : 'justify-start'}`}
              >
                <div className={getMessageClasses(message)}>
                  {message.sender === 'thinking' ? (
                    <div className="flex items-center">
                      <div className="flex space-x-1 mr-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <span>{renderMessageContent(message)}</span>
                    </div>
                  ) : (
                    <div className="break-words">{renderMessageContent(message)}</div>
                  )}
                  <div className={getTimestampClasses(message)}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && !messages.some(msg => msg.sender === 'thinking') && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-2 bg-gray-200 dark:bg-gray-700 rounded-bl-none">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg">No messages yet</p>
            <p className="mt-2">Start a conversation below</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - 减小输入区域的内边距 */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isLoading}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
} 