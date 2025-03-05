"use client"

import { WalletInfo } from '../types/chat';
import LoginButton from './LoginButton';
import { usePrivyAuth } from '../hooks/usePrivyAuth';

interface AppAreaProps {
  walletInfo: WalletInfo;
  onOpenChat: () => void;
  isMobile: boolean;
}

export default function AppArea({ walletInfo, onOpenChat, isMobile }: AppAreaProps) {
  const { isAuthenticated, displayName: privyDisplayName } = usePrivyAuth();
  
  // 如果用户已登录，尝试使用Privy账户信息
  const displayName = isAuthenticated 
    ? (privyDisplayName || walletInfo.username)
    : walletInfo.username;
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 p-6 relative">
      {/* User profile and balance */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <img 
            src={walletInfo.avatarUrl || 'https://via.placeholder.com/150'} 
            alt={`${displayName}'s avatar`}
            className="w-10 h-10 rounded-full object-cover border-2 border-gray-300 dark:border-gray-700"
          />
          <span className="ml-2 font-semibold">{displayName}</span>
        </div>
        <LoginButton />
      </div>

      {/* Wallet balance */}
      <div className="bg-white dark:bg-gray-900 rounded-lg mb-8 text-center py-8">
        <div className="flex items-center justify-center">
          <span className="text-gray-400 dark:text-gray-500 text-5xl mr-2">$</span>
          <span className="text-5xl font-bold">{walletInfo.balance}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <button className="flex flex-col items-center justify-center rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <span className="text-lg">Send</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <span className="text-lg">Swap</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <span className="text-lg">Top up</span>
        </button>
      </div>

      {isAuthenticated ? (
        <div className="text-center mb-2">
          <p className="text-gray-500 dark:text-gray-400">Your wallet is ready</p>
        </div>
      ) : (
        <div className="text-center mb-2">
          <p className="text-gray-500 dark:text-gray-400">Login to use your wallet</p>
        </div>
      )}

      {/* "Buy crypto" button */}
      <button 
        className="bg-black text-white rounded-lg py-3 w-full hover:bg-gray-800 transition-colors"
        disabled={!isAuthenticated}
      >
        Buy crypto
      </button>

      {/* Mobile chat button */}
      {isMobile && (
        <button 
          onClick={onOpenChat}
          className="absolute bottom-6 right-6 bg-blue-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors"
          aria-label="Open chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
    </div>
  );
} 