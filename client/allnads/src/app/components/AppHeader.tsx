"use client";

import { usePrivyAuth } from '../hooks/usePrivyAuth';

export default function AppHeader() {
  const { user, logout } = usePrivyAuth();
  
  const email = user?.email?.address;
  const walletAddress = user?.wallet?.address;
  const displayName = email || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'User');
  
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
      <div className="flex items-center">
        <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
          <div className="w-4 h-4 bg-white rotate-45"></div>
        </div>
        <span className="ml-3 font-medium">AllNads</span>
      </div>
      
      <div className="flex items-center">
        <div className="mr-4 text-sm font-medium text-gray-700">
          {displayName}
        </div>
        <button
          onClick={logout}
          className="px-3 py-1.5 bg-gray-100 text-gray-800 text-sm rounded-lg hover:bg-gray-200 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
} 