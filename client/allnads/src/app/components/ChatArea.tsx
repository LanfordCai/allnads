"use client"

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/chat';
import { parseEther, isAddress } from 'viem';
import { useWallets } from '@privy-io/react-auth';
import { useNotification } from '../contexts/NotificationContext';
import { useAllNads } from '../hooks/useAllNads';
import { blockchainService } from '../services/blockchain';
import { useTemplateOwnership } from '../hooks/useTemplateOwnership';
import { usePrivyAuth } from '../hooks/usePrivyAuth';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
  isMediumScreen?: boolean;
  isSidebarOpen?: boolean;
  avatarImage?: string | null;
  onAvatarImageChange?: (newAvatarImage: string | null) => void;
  isInModal?: boolean;
  nftAccount?: string | null;
}

export default function ChatArea({ 
  messages, 
  onSendMessage, 
  isLoading = false,
  onToggleSidebar,
  isMobile = false,
  isMediumScreen = false,
  isSidebarOpen = true,
  avatarImage = null,
  onAvatarImageChange,
  isInModal = false,
  nftAccount = null
}: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { wallets } = useWallets();
  const [isSigningTransaction, setIsSigningTransaction] = useState(false);
  const { showNotification } = useNotification();
  const [localAvatarImage, setLocalAvatarImage] = useState<string | null>(avatarImage);
  const [isRefreshingNFT, setIsRefreshingNFT] = useState(false);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const { user } = usePrivyAuth();

  // Check if the wallet is delegated
  const isWalletDelegated = !!user?.linkedAccounts?.find(
    (account) => account.type === 'wallet' && 'delegated' in account && account.delegated
  );

  // Function to handle angry button click
  const handleAngryButtonClick = () => {
    const warningMessages = [
      "DID YOU ACTUALLY PERFORM THIS ACTION? IF NOT, GO BACK AND DO IT PROPERLY NOW.",
      "PLEASE CONFIRM YOU REALLY COMPLETED THIS ACTION. IF NOT, YOU NEED TO DO IT CORRECTLY.",
      "VERIFY: DID YOU TRULY EXECUTE THIS ACTION? IF YOU'RE FAKING IT, GO BACK AND DO IT RIGHT.",
      "DID YOU ACTUALLY DO THIS? DON'T DECEIVE THE SYSTEM - IF NOT, COMPLETE THE ACTION PROPERLY.",
      "SYSTEM CHECK: DID YOU REALLY PERFORM THIS ACTION? IF NOT, PLEASE GO BACK AND DO IT NOW.",
      "BE HONEST: DID YOU COMPLETE THIS TASK? IF NOT, RETURN AND FINISH IT PROPERLY.",
      "WARNING: IF YOU HAVEN'T ACTUALLY EXECUTED THIS ACTION, GO BACK AND DO IT CORRECTLY NOW."
    ];
    const randomIndex = Math.floor(Math.random() * warningMessages.length);
    onSendMessage(warningMessages[randomIndex]);
  };

  // Function to handle happy button click
  const handleHappyButtonClick = () => {
    const praiseMessages = [
      "EXCELLENT WORK! YOU'VE COMPLETED THIS TASK PERFECTLY! 🌟",
      "OUTSTANDING JOB ON THIS ACTION! KEEP UP THE GREAT WORK! 🎉",
      "PHENOMENAL EXECUTION! YOU'RE DOING EXACTLY WHAT YOU SHOULD! ⭐",
      "BRILLIANT WORK! THIS IS EXACTLY HOW IT SHOULD BE DONE! 🏆",
      "PERFECT! YOU'RE FOLLOWING THE PROCESS EXACTLY AS INTENDED! 💫",
      "FANTASTIC JOB! YOUR ATTENTION TO DETAIL IS IMPRESSIVE! 🌠",
      "SUPERB WORK! YOU'RE MASTERING THIS PROCESS! 🎯"
    ];
    const randomIndex = Math.floor(Math.random() * praiseMessages.length);
    onSendMessage(praiseMessages[randomIndex]);
  };

  // Use the useAllNads hook to get NFT information
  const { tokenId } = useAllNads();

  // Use the template ownership hook
  const { ownedTemplates, checkOwnership } = useTemplateOwnership();

  // Update local avatar image when prop changes
  useEffect(() => {
    setLocalAvatarImage(avatarImage);
  }, [avatarImage]);

  // Check for <<ComponentChanged>> and <<ComponentMinted>> in messages
  useEffect(() => {
    const checkForComponentChanged = async () => {
      // Only continue if there are messages
      if (messages.length === 0) return;
      
      // Only check the latest message
      const latestMessage = messages[messages.length - 1];
      
      // Skip if this message has already been processed
      if (!latestMessage || processedMessageIdsRef.current.has(latestMessage.id)) {
        return;
      }
      
      console.log(`Checking message ID: ${latestMessage.id}, content: ${latestMessage.content.substring(0, 50)}...`);
      
      // Check if the message is from the bot
      if (latestMessage.role === 'bot') {
        // Mark this message as processed
        processedMessageIdsRef.current.add(latestMessage.id);
        
        // Process all tags in the message
        let hasComponentChanged = false;
        let hasComponentMinted = false;
        
        // Check for tags
        hasComponentChanged = latestMessage.content.includes('<<ComponentChanged>>');
        hasComponentMinted = latestMessage.content.includes('<<ComponentMinted>>');
        
        // Handle ComponentChanged tag
        if (hasComponentChanged && !isRefreshingNFT && tokenId) {
          console.log(`Found <<ComponentChanged>> tag, starting to refresh NFT metadata, message ID: ${latestMessage.id}`);
          
          setIsRefreshingNFT(true);
          showNotification('Refreshing NFT metadata...', 'info');
          
          try {
            // Use blockchain service to get token URI
            const tokenURI = await blockchainService.getTokenURI(tokenId);
            
            // Parse tokenURI
            const jsonData = tokenURI.replace('data:application/json,', '');
            const json = JSON.parse(jsonData);
            
            console.log('Retrieved NFT metadata:', json);
            
            // Extract image from tokenURI
            if (json.image) {
              setLocalAvatarImage(json.image);
              // Notify parent component about the avatar image change
              if (onAvatarImageChange) {
                onAvatarImageChange(json.image);
              }
              console.log('NFT avatar updated:', json.image.substring(0, 50) + '...');
              showNotification('NFT metadata updated', 'success');
            } else {
              throw new Error("NFT metadata doesn't contain an image");
            }
          } catch (error) {
            console.error('Error refreshing NFT metadata:', error);
            showNotification('Failed to refresh NFT metadata', 'error');
          } finally {
            setIsRefreshingNFT(false);
          }
        }
        
        // Handle ComponentMinted tag
        if (hasComponentMinted && nftAccount) {
          console.log(`Found <<ComponentMinted>> tag, rechecking template ownership, message ID: ${latestMessage.id}`);
          
          showNotification('Updating template ownership...', 'info');
          
          try {
            // Recheck template ownership using the hook's function with forceRefresh=true
            await checkOwnership(nftAccount, true);
            
            console.log('Template ownership updated for account:', nftAccount);
            showNotification('Template ownership updated', 'success');
          } catch (error) {
            console.error('Error updating template ownership:', error);
            showNotification('Failed to update template ownership', 'error');
          }
        }
      }
    };
    
    checkForComponentChanged();
  }, [messages, tokenId, isRefreshingNFT, onAvatarImageChange, showNotification, ownedTemplates, nftAccount, checkOwnership]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (trimmedMessage) {
      onSendMessage(trimmedMessage);
      setNewMessage('');
    }
  };

  // Handle transaction signing
  const handleSignTransaction = async (to: string, data: string, value: string) => {
    try {
      setIsSigningTransaction(true);
      showNotification('Processing transaction signature request...', 'info');
      
      // Get user wallet
      if (!wallets || wallets.length === 0) {
        throw new Error("No wallet connected");
      }
      
      // Use the first wallet
      const wallet = wallets.find((wallet) => wallet.walletClientType === 'privy')!;
      
      // Get the wallet's Ethereum provider
      console.log(wallet.chainId);
      const provider = await wallet.getEthereumProvider();
      
      // Prepare transaction request
      const transactionRequest = {
        to: to,
        data: data,
        value: value === '0' ? '0x0' : `0x${parseEther(value).toString(16)}`, // Convert to hexadecimal
      };
      
      // Send transaction request
      const transactionHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [transactionRequest],
      });
      
      // Transaction successful, show success notification
      showNotification(`Transaction submitted, transaction hash: ${transactionHash}`, 'success');
      
      // Send transaction hash to chat interface
      onSendMessage(`I have signed and sent the transaction, the transaction hash is: ${transactionHash}`);
      
    } catch (error) {
      console.error('Transaction signing error:', error);
      // Show error notification
      showNotification(`Transaction signing failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsSigningTransaction(false);
    }
  };

  // Render message content, supporting line breaks and tool call formats
  const renderMessageContent = (message: ChatMessage) => {
    // First, trim the entire message content
    const trimmedContent = message.content.trim();
    
    // If it's a tool message, format it for display
    if (message.role === 'tool') {
      // Split the message content, extract tool information
      const parts = trimmedContent.split('\n\n');
      if (parts.length >= 2) {
        const [, ...details] = parts;
        
        // Check if it's an MCP tool call format (e.g., evm_tool__evm_transaction_info)
        const toolName = details[0]?.split(': ')[1]?.split('\n')[0];
        const isMcpTool = toolName && toolName.includes('__');
        
        if (isMcpTool) {
          // Split tool name into two tags
          const [leftTag, rightTag] = toolName.split('__').map(tag => 
            tag.split('_').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join('')
          );
          
          return (
            <>
              <div className="text-xs text-gray-500 mb-1 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Calling
                <div className="ml-1 flex">
                  <span className="bg-[#7C3AED] text-white px-2 py-0.5 rounded-l-md rounded-r-none text-xs font-medium">{leftTag}</span>
                  <span className="bg-[#EDE9FE] dark:bg-[#7C3AED]/30 text-[#7C3AED] dark:text-white px-2 py-0.5 rounded-r-md rounded-l-none text-xs font-medium">{rightTag}</span>
                </div>
              </div>
              <div className="text-xs font-mono overflow-x-auto">
                {details.slice(1).map((detail, i) => (
                  <div key={i} className="text-gray-600 dark:text-gray-400">{detail}</div>
                ))}
              </div>
            </>
          );
        }
        
        // Original tool call display
        return (
          <>
            <div className="text-xs text-gray-500 mb-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              Calling
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
    
    // If it's a transaction signature message, special format it for display
    if (message.role === 'transaction_to_sign') {
      // Split the message content, extract transaction information
      const parts = trimmedContent.split('\n\n');
      if (parts.length >= 2) {
        const mainContent = parts[0];
        const transactionInfo = parts.slice(1).join('\n\n');
        
        // Parse transaction information
        const infoLines = transactionInfo.split('\n');
        const to = infoLines.find(line => line.startsWith('To:'))?.split(': ')[1] || '';
        const data = infoLines.find(line => line.startsWith('Data:'))?.split(': ')[1] || '';
        const value = infoLines.find(line => line.startsWith('Value:'))?.split(': ')[1]?.split(' ')[0] || '0';
        
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
                {!isWalletDelegated && (
                  <button 
                    className={`${isSigningTransaction 
                      ? 'bg-gray-400 cursor-not-allowed border-gray-500' 
                      : 'bg-[#8B5CF6] hover:bg-[#7C3AED] border-[#7C3AED] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]'} 
                      text-white px-4 py-2 rounded-lg text-sm transition-all font-bold uppercase border-2 shadow-[4px_4px_0px_0px_#5B21B6]`}
                    onClick={() => handleSignTransaction(to, data, value)}
                    disabled={isSigningTransaction}
                  >
                    {isSigningTransaction ? 'Signing...' : 'Sign'}
                  </button>
                )}
                {isWalletDelegated && (
                  <div className="bg-[#22c55e] text-white text-xs font-medium px-3 py-1 rounded-full">
                    Transaction will be auto-signed (wallet delegated)
                  </div>
                )}
              </div>
            </div>
          </>
        );
      }
    }
    
    // Helper function to detect and format Ethereum addresses and transaction IDs
    const formatEthereumEntities = (text: string) => {
      // Regex for Ethereum addresses (0x followed by 40 hex characters)
      const addressRegex = /(0x[a-fA-F0-9]{40})/g;
      
      // Regex for Ethereum transaction IDs (0x followed by 64 hex characters)
      const txidRegex = /(0x[a-fA-F0-9]{64})/g;
      
      // First split by possible txids (they're longer, so we check them first)
      const txidParts = text.split(txidRegex);
      
      if (txidParts.length > 1) {
        return (
          <>
            {txidParts.map((part, i) => {
              // Every odd index is a match
              if (i % 2 === 1 && txidRegex.test(part)) {
                return (
                  <a 
                    key={i} 
                    href={`https://testnet.monadexplorer.com/tx/${part}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-purple-500 decoration-2 text-inherit hover:text-purple-500 transition-colors"
                  >
                    {part}
                  </a>
                );
              }
              
              // For non-txid parts, check for addresses
              const addressParts = part.split(addressRegex);
              if (addressParts.length > 1) {
                return (
                  <span key={i}>
                    {addressParts.map((addressPart, j) => {
                      // Verify it's a valid Ethereum address using isAddress
                      if (j % 2 === 1 && isAddress(addressPart)) {
                        return (
                          <a 
                            key={j} 
                            href={`https://testnet.monadexplorer.com/address/${addressPart}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-purple-500 decoration-2 text-inherit hover:text-purple-500 transition-colors"
                          >
                            {addressPart}
                          </a>
                        );
                      }
                      return addressPart;
                    })}
                  </span>
                );
              }
              
              return part;
            })}
          </>
        );
      }
      
      // If no txids found, check for addresses
      const addressParts = text.split(addressRegex);
      if (addressParts.length > 1) {
        return (
          <>
            {addressParts.map((part, i) => {
              // Every odd index is a match
              if (i % 2 === 1 && isAddress(part)) {
                return (
                  <a 
                    key={i} 
                    href={`https://testnet.monadexplorer.com/address/${part}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-purple-500 decoration-2 text-inherit hover:text-purple-500 transition-colors"
                  >
                    {part}
                  </a>
                );
              }
              return part;
            })}
          </>
        );
      }
      
      // If no matches, return the original text
      return text;
    };
    
    // Handle normal text (supporting line breaks, <<ComponentChanged>> tags, <<ComponentMinted>> tags, and Ethereum entities)
    return trimmedContent.split('\n').map((line, i) => {
      // Check if it contains the <<ComponentChanged>> tag
      if (line.includes('<<ComponentChanged>>')) {
        // Replace <<ComponentChanged>> tag with styled version
        const parts = line.split('<<ComponentChanged>>');
        return (
          <span key={i}>
            {formatEthereumEntities(parts[0])}
            <span className="text-xs opacity-50 italic text-gray-500 dark:text-gray-400">&lt;ComponentChanged&gt;</span>
            {formatEthereumEntities(parts[1])}
            {i < trimmedContent.split('\n').length - 1 && <br />}
          </span>
        );
      }
      
      // Check if it contains the <<ComponentMinted>> tag
      if (line.includes('<<ComponentMinted>>')) {
        // Replace <<ComponentMinted>> tag with styled version
        const parts = line.split('<<ComponentMinted>>');
        return (
          <span key={i}>
            {formatEthereumEntities(parts[0])}
            <span className="text-xs opacity-50 italic text-green-600 dark:text-green-400">&lt;ComponentMinted&gt;</span>
            {formatEthereumEntities(parts[1])}
            {i < trimmedContent.split('\n').length - 1 && <br />}
          </span>
        );
      }
      
      // Normal line with Ethereum entity detection
      return (
        <span key={i}>
          {formatEthereumEntities(line)}
          {i < trimmedContent.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  // Get message style classes
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

  // Get message timestamp style classes
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

  // 跟踪消息列表的引用，用于检测会话切换
  const messagesRef = useRef<ChatMessage[]>(messages);
  // 跟踪消息数量的变化
  const prevMessagesLengthRef = useRef(messages.length);
  // 跟踪是否是首次加载
  const isFirstLoadRef = useRef(true);
  // Reference to the last message element for resize observation
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  // Reference to the loading indicator element
  const loadingIndicatorRef = useRef<HTMLDivElement | null>(null);
  // Reference to the messages container
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  
  // 直接设置滚动位置到底部，不使用滚动动画
  const jumpToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  };
  
  // 平滑滚动到底部
  const smoothScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 在会话加载或新消息添加时处理滚动
  useEffect(() => {
    // 检测是否是会话切换（消息ID完全不同）
    const isSessionChange = messages.length > 0 && messagesRef.current.length > 0 && 
                           messages[0]?.id !== messagesRef.current[0]?.id;
    
    // 检测是否有新消息添加（消息数量增加）
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;
    
    // 首次加载或会话切换时，直接跳到底部，不使用滚动动画
    if (isFirstLoadRef.current || isSessionChange) {
      // 使用 setTimeout 确保 DOM 已更新
      setTimeout(jumpToBottom, 0);
      isFirstLoadRef.current = false;
    } else if (hasNewMessages) {
      // 新消息添加时，平滑滚动到底部
      smoothScrollToBottom();
    }
    
    // 更新引用
    messagesRef.current = messages;
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // 使用 ResizeObserver 检测消息内容大小变化
  useEffect(() => {
    // 只在有消息时观察
    if (messages.length === 0 && !isLoading) return;
    
    // 创建 ResizeObserver 来监视最后一条消息和加载指示器
    const resizeObserver = new ResizeObserver(() => {
      // 当观察到的元素大小变化时，确保它可见
      if (isFirstLoadRef.current) {
        jumpToBottom();
      } else {
        smoothScrollToBottom();
      }
    });
    
    // 如果我们有最后一条消息元素的引用，观察它
    if (lastMessageRef.current) {
      resizeObserver.observe(lastMessageRef.current);
    }
    
    // 如果我们有加载指示器的引用且它可见，观察它
    if (loadingIndicatorRef.current && isLoading) {
      resizeObserver.observe(loadingIndicatorRef.current);
    }
    
    // 清理函数，在组件卸载时断开观察器
    return () => {
      resizeObserver.disconnect();
    };
  }, [messages.length, isLoading]);

  // 使用 MutationObserver 检测消息容器中添加的新内容
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    
    // 创建 MutationObserver 来监视消息容器的变化
    const mutationObserver = new MutationObserver(() => {
      // 当添加新内容时，确保它可见
      if (isFirstLoadRef.current) {
        jumpToBottom();
      } else {
        smoothScrollToBottom();
      }
    });
    
    // 开始观察消息容器以检测其子元素的变化
    mutationObserver.observe(messagesContainerRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // 清理函数，在组件卸载时断开观察器
    return () => {
      mutationObserver.disconnect();
    };
  }, []);

  // 组件挂载后立即跳转到底部
  useEffect(() => {
    // 确保在组件挂载后立即跳转到底部
    if (messagesContainerRef.current && messages.length > 0) {
      // 使用 requestAnimationFrame 确保在浏览器绘制后执行
      requestAnimationFrame(() => {
        jumpToBottom();
      });
    }
  }, []);

  // 强制在会话切换时立即跳转到底部
  useEffect(() => {
    // 如果有消息且容器已渲染
    if (messages.length > 0 && messagesContainerRef.current) {
      // 使用多个延迟的跳转，确保在所有可能的时间点都尝试跳转到底部
      // 这是为了解决某些情况下 DOM 更新时机不确定的问题
      const jumpMultipleTimes = () => {
        // 立即跳转
        jumpToBottom();
        
        // 在下一帧跳转
        requestAnimationFrame(() => {
          jumpToBottom();
          
          // 短暂延迟后再次跳转
          setTimeout(() => {
            jumpToBottom();
            
            // 稍长延迟后最后一次跳转
            setTimeout(jumpToBottom, 100);
          }, 50);
        });
      };
      
      // 执行多次跳转
      jumpMultipleTimes();
    }
  }, [messages.length > 0 ? messages[0].id : null]); // 只在第一条消息ID变化时触发（会话切换）

  // Monitor message content changes to ensure proper scrolling
  useEffect(() => {
    // If there are no messages, no need to check
    if (messages.length === 0) return;
    
    // Get the last message
    const lastMessage = messages[messages.length - 1];
    
    // If the last message is from the bot or a tool, it might be updated with new content
    if (['bot', 'tool'].includes(lastMessage.role)) {
      // Scroll to ensure the message is visible
      smoothScrollToBottom();
    }
  }, [messages.map(m => m.content).join('')]); // Dependency on message content

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 chat-area-container">
      {/* Toggle sidebar button for mobile and medium screens - Not shown in modal */}
      {(isMobile || isMediumScreen) && !isInModal && (
        <div className="p-2 border-b-4 border-[#8B5CF6] bg-white dark:bg-gray-800 sticky top-0 z-[10]">
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
              className={`${isSidebarOpen ? 'transform rotate-90' : ''} text-[#8B5CF6] transition-transform duration-300`}
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      {/* Add global scrollbar styles */}
      <style jsx global>{`
        /* Scrollbar overall style */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        /* Scrollbar track */
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        
        /* Scrollbar slider */
        ::-webkit-scrollbar-thumb {
          background: #C4B5FD;
          border-radius: 10px;
        }
        
        /* Scrollbar slider style when hovered */
        ::-webkit-scrollbar-thumb:hover {
          background: #A78BFA;
        }

        /* Ensure scrollbar is always visible */
        .messages-container {
          scrollbar-width: thin;
          scrollbar-color: #C4B5FD #f1f1f1;
        }
        
        .messages-container::-webkit-scrollbar {
          width: 6px;
        }
        
        .messages-container::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .messages-container::-webkit-scrollbar-thumb {
          background-color: #C4B5FD;
          border-radius: 10px;
        }
      `}</style>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto px-0 py-6 messages-container" ref={messagesContainerRef}>
          <div className="max-w-3xl mx-auto px-6 space-y-4">
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
              
              // Check if this is the last message to attach the ref
              const isLastMessage = index === messages.length - 1;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'}`}
                  ref={isLastMessage ? lastMessageRef : null}
                >
                  {(message.role === 'bot' || message.role === 'tool' || message.role === 'error' || message.role === 'thinking' || message.role === 'transaction_to_sign') && shouldShowAvatar && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden mr-2 flex-shrink-0 border-2 border-[#8B5CF6]">
                      <img 
                        src={localAvatarImage || "/placeholder.png"} 
                        alt="AI Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback if image fails to load
                          e.currentTarget.src = "/placeholder.png";
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
              messages.length > 0 && messages[messages.length - 1].role === 'thinking' ? null : (
                <div className="flex justify-start" ref={loadingIndicatorRef}>
                  {/* Only show avatar if last message was not from AI */}
                  {(messages.length === 0 || !['bot', 'tool', 'error', 'thinking', 'transaction_to_sign'].includes(messages[messages.length - 1].role)) && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden mr-2 flex-shrink-0 border-2 border-[#8B5CF6]">
                      <img 
                        src={localAvatarImage || "/placeholder.png"} 
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
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Message input */}
      <div className="px-4 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-t-[2rem] overflow-hidden shadow-md border-2 border-[#C4B5FD]">
            <form onSubmit={handleSubmit} className="relative">
              <div className="px-6 py-5 flex items-center gap-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={nftAccount ? "Type a message..." : "You need an NFT to send messages. Get an NFT first."}
                  className="w-full focus:outline-none bg-transparent dark:text-white text-gray-800 text-lg"
                  disabled={isLoading || !nftAccount}
                />
                <div className="flex-shrink-0 flex gap-2">
                  <button
                    type="button"
                    onClick={handleHappyButtonClick}
                    className="w-12 h-12 flex items-center justify-center text-2xl bg-green-100 hover:bg-green-200 rounded-full border-2 border-green-300 transition-all hover:scale-105 shadow-md"
                    disabled={isLoading || !nftAccount}
                    title="Send praise message"
                  >
                    😊
                  </button>
                  <button
                    type="button"
                    onClick={handleAngryButtonClick}
                    className="w-12 h-12 flex items-center justify-center text-2xl bg-red-100 hover:bg-red-200 rounded-full border-2 border-red-300 transition-all hover:scale-105 shadow-md"
                    disabled={isLoading || !nftAccount}
                    title="Send warning message"
                  >
                    😡
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end py-2 px-6 border-t border-[#C4B5FD]/30">
                <button
                  type="submit"
                  className={`
                    w-[104px] py-1 px-4 rounded-xl font-black text-center uppercase transition-all
                    ${!newMessage.trim() || isLoading || !nftAccount
                      ? 'bg-purple-200 text-purple-400 border-4 border-purple-300 cursor-not-allowed'
                      : 'bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]'
                    }
                  `}
                  disabled={!newMessage.trim() || isLoading || !nftAccount}
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  function formatTime(date: Date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
} 