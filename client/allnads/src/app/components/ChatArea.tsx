"use client"

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/chat';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { parseEther } from 'viem';
import { useWallets } from '@privy-io/react-auth';
import { useNotification } from '../contexts/NotificationContext';
import { useAllNads } from '../hooks/useAllNads';
import { blockchainService } from '../services/blockchain';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
  isSidebarOpen?: boolean;
  avatarImage?: string | null;
  onAvatarImageChange?: (newAvatarImage: string | null) => void;
}

export default function ChatArea({ 
  messages, 
  onSendMessage, 
  isLoading = false,
  onToggleSidebar,
  isMobile = false,
  isSidebarOpen = true,
  avatarImage = null,
  onAvatarImageChange
}: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { privy } = usePrivyAuth();
  const { wallets } = useWallets();
  const [isSigningTransaction, setIsSigningTransaction] = useState(false);
  const { showNotification } = useNotification();
  const [localAvatarImage, setLocalAvatarImage] = useState<string | null>(avatarImage);
  const [isRefreshingNFT, setIsRefreshingNFT] = useState(false);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // Use the useAllNads hook to get NFT information
  const { tokenId, nftAccount } = useAllNads();

  // Update local avatar image when prop changes
  useEffect(() => {
    setLocalAvatarImage(avatarImage);
  }, [avatarImage]);

  // Check for <ComponentChanged> in messages and refresh NFT metadata
  useEffect(() => {
    const checkForComponentChanged = async () => {
      // 只有当有消息时才继续
      if (messages.length === 0) return;
      
      // 只检查最新的消息
      const latestMessage = messages[messages.length - 1];
      
      // 如果这个消息已经处理过，则跳过
      if (!latestMessage || processedMessageIdsRef.current.has(latestMessage.id)) {
        return;
      }
      
      console.log(`检查消息 ID: ${latestMessage.id}, 内容: ${latestMessage.content.substring(0, 50)}...`);
      
      // 检查消息是否包含 <ComponentChanged> 标签
      if (latestMessage.role === 'bot' && 
          latestMessage.content.includes('<ComponentChanged>') && 
          !isRefreshingNFT && tokenId) {
        
        // 标记这个消息已处理
        processedMessageIdsRef.current.add(latestMessage.id);
        console.log(`发现 <ComponentChanged> 标签，开始刷新 NFT 元数据，消息 ID: ${latestMessage.id}`);
        
        setIsRefreshingNFT(true);
        showNotification('正在刷新 NFT 元数据...', 'info');
        
        try {
          // 使用 blockchain 服务获取 token URI
          const tokenURI = await blockchainService.getTokenURI(tokenId);
          
          // Parse tokenURI
          const jsonData = tokenURI.replace('data:application/json,', '');
          const json = JSON.parse(jsonData);
          
          console.log('获取到的 NFT 元数据:', json);
          
          // Extract image from tokenURI
          if (json.image) {
            setLocalAvatarImage(json.image);
            // Notify parent component about the avatar image change
            if (onAvatarImageChange) {
              onAvatarImageChange(json.image);
            }
            console.log('NFT 头像已更新:', json.image.substring(0, 50) + '...');
            showNotification('NFT 元数据已更新', 'success');
          } else {
            throw new Error("NFT metadata doesn't contain an image");
          }
        } catch (error) {
          console.error('Error refreshing NFT metadata:', error);
          showNotification('刷新 NFT 元数据失败', 'error');
        } finally {
          setIsRefreshingNFT(false);
        }
      } else {
        // 即使不包含 <ComponentChanged>，也标记为已处理
        processedMessageIdsRef.current.add(latestMessage.id);
      }
    };
    
    checkForComponentChanged();
  }, [messages, tokenId, isRefreshingNFT, onAvatarImageChange, showNotification]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (trimmedMessage) {
      onSendMessage(trimmedMessage);
      setNewMessage('');
    }
  };

  // 处理交易签名
  const handleSignTransaction = async (to: string, data: string, value: string) => {
    try {
      setIsSigningTransaction(true);
      showNotification('正在处理交易签名请求...', 'info');
      
      // 获取用户钱包
      if (!wallets || wallets.length === 0) {
        throw new Error("No wallet connected");
      }
      
      // 使用第一个钱包
      const wallet = wallets.find((wallet) => wallet.walletClientType === 'privy')!;
      
      // 获取钱包的以太坊提供者
      console.log(wallet.chainId);
      const provider = await wallet.getEthereumProvider();
      
      // 准备交易请求
      const transactionRequest = {
        to: to,
        data: data,
        value: value === '0' ? '0x0' : `0x${parseEther(value).toString(16)}`, // 转换为十六进制
      };
      
      // 发送交易请求
      const transactionHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [transactionRequest],
      });
      
      // 交易成功，显示成功通知
      showNotification(`交易已提交，交易哈希: ${transactionHash}`, 'success');
      
      // 将交易哈希发送到聊天界面
      onSendMessage(`我已经签署并发送了交易，交易哈希是: ${transactionHash}`);
      
    } catch (error) {
      console.error('Transaction signing error:', error);
      // 显示错误通知
      showNotification(`交易签名失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsSigningTransaction(false);
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
        
        // 解析交易信息
        const infoLines = transactionInfo.split('\n');
        const to = infoLines.find(line => line.startsWith('收款地址:'))?.split(': ')[1] || '';
        const data = infoLines.find(line => line.startsWith('数据:'))?.split(': ')[1] || '';
        const value = infoLines.find(line => line.startsWith('金额:'))?.split(': ')[1]?.split(' ')[0] || '0';
        
        return (
          <>
            <div className="mb-2">{mainContent}</div>
            <div className="bg-[#F3F0FF] dark:bg-[#4C1D95] p-3 rounded-lg border-2 border-[#8B5CF6] dark:border-[#7C3AED] overflow-x-auto">
              <div className="font-medium text-[#6D28D9] dark:text-[#C4B5FD] mb-2">
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
                <button 
                  className={`${isSigningTransaction 
                    ? 'bg-gray-400 cursor-not-allowed border-gray-500' 
                    : 'bg-[#8B5CF6] hover:bg-[#7C3AED] border-[#7C3AED] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]'} 
                    text-white px-4 py-2 rounded-lg text-sm transition-all font-bold uppercase border-2 shadow-[4px_4px_0px_0px_#5B21B6]`}
                  onClick={() => handleSignTransaction(to, data, value)}
                  disabled={isSigningTransaction}
                >
                  {isSigningTransaction ? '签名中...' : '签名交易'}
                </button>
              </div>
            </div>
          </>
        );
      }
    }
    
    // 处理正常文本（支持换行和 <ComponentChanged> 标签）
    return trimmedContent.split('\n').map((line, i) => {
      // 检查是否包含 <ComponentChanged> 标签
      if (line.includes('<ComponentChanged>')) {
        // 将 <ComponentChanged> 标签替换为带样式的版本
        const parts = line.split('<ComponentChanged>');
        return (
          <span key={i}>
            {parts[0]}
            <span className="text-xs opacity-50 italic text-gray-500 dark:text-gray-400">&lt;ComponentChanged&gt;</span>
            {parts[1]}
            {i < trimmedContent.split('\n').length - 1 && <br />}
          </span>
        );
      }
      
      // 正常行
      return (
        <span key={i}>
          {line}
          {i < trimmedContent.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  // 获取消息的样式类
  const getMessageClasses = (message: ChatMessage) => {
    const baseClasses = "max-w-[80%] rounded-xl p-3 ";
    
    switch (message.role) {
      case 'user':
        return `${baseClasses} bg-[#8B5CF6] text-white rounded-br-none ml-auto border-2 border-[#7C3AED]`;
      case 'bot':
        return `${baseClasses} bg-white dark:bg-gray-800 rounded-bl-none border-2 border-gray-200 dark:border-gray-700`;
      case 'thinking':
        return `${baseClasses} bg-white dark:bg-gray-800 rounded-bl-none border-2 border-gray-200 dark:border-gray-700 animate-pulse`;
      case 'system':
        return `${baseClasses} bg-[#F3F0FF] dark:bg-[#4C1D95] text-center italic mx-auto border-2 border-[#C4B5FD] dark:border-[#7C3AED]`;
      case 'tool':
        return `${baseClasses} bg-white dark:bg-gray-800 rounded-bl-none border-2 border-gray-200 dark:border-gray-700`;
      case 'transaction_to_sign':
        return `${baseClasses} bg-white dark:bg-gray-800 rounded-bl-none border-2 border-[#C4B5FD] dark:border-[#7C3AED]`;
      case 'error':
        return `${baseClasses} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-2 border-red-300 dark:border-red-700`;
      default:
        return baseClasses;
    }
  };

  // 获取消息的时间戳样式
  const getTimestampClasses = (message: ChatMessage) => {
    const baseClasses = "text-xs mt-1 ";
    
    switch (message.role) {
      case 'user':
        return `${baseClasses} text-purple-200 text-right`;
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* 移除顶部标题栏 */}
      {isMobile && (
        <div className="p-2 border-b-4 border-[#8B5CF6] bg-white dark:bg-gray-800">
          <button 
            onClick={onToggleSidebar} 
            className="p-2 rounded-lg hover:bg-[#F3F0FF] dark:hover:bg-[#4C1D95] transition-colors focus:outline-none"
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
              className={`${isSidebarOpen ? 'transform rotate-90' : ''} text-[#8B5CF6]`}
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                <div className="w-12 h-12 rounded-lg overflow-hidden mr-2 flex-shrink-0 border-2 border-[#8B5CF6]">
                  <img 
                    src={localAvatarImage || "https://picsum.photos/500/500"} 
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
              <div className="w-12 h-12 rounded-lg overflow-hidden mr-2 flex-shrink-0 border-2 border-[#8B5CF6]">
                <img 
                  src={localAvatarImage || "https://picsum.photos/500/500"} 
                  alt="AI Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {/* Add empty space to maintain alignment when avatar is not shown */}
            {messages.length > 0 && ['bot', 'tool', 'error', 'thinking', 'transaction_to_sign'].includes(messages[messages.length - 1].role) && (
              <div className="w-12 mr-2 flex-shrink-0"></div>
            )}
            <div className="max-w-[80%] rounded-xl p-3 bg-white dark:bg-gray-800 rounded-bl-none border-2 border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2 items-center">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-[#8B5CF6] dark:bg-[#A78BFA] animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-[#8B5CF6] dark:bg-[#A78BFA] animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-[#8B5CF6] dark:bg-[#A78BFA] animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t-4 border-[#8B5CF6]">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border-2 border-[#C4B5FD] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-[#8B5CF6] bg-white dark:bg-gray-700 dark:text-white"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`
              py-3 px-6 rounded-xl font-black text-center uppercase transition-all
              border-4 
              ${!newMessage.trim() || isLoading
                ? 'bg-purple-200 text-purple-400 border-purple-300 cursor-not-allowed'
                : 'bg-[#8B5CF6] text-white border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]'
              }
            `}
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