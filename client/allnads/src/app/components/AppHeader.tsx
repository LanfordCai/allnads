"use client";

import { usePrivyAuth } from '../hooks/usePrivyAuth';

export default function AppHeader() {
  const { user, logout } = usePrivyAuth();
  
  const email = user?.email?.address;
  const walletAddress = user?.wallet?.address;
  const displayName = email || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'User');
  
  return (
    <header className="bg-[#8B5CF6] border-b-4 border-[#7C3AED] px-4 py-4 flex justify-between items-center shadow-md">
      <div className="flex items-center">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border-2 border-white shadow-[2px_2px_0px_0px_#5B21B6]">
          <div className="w-5 h-5 bg-[#8B5CF6] rotate-45"></div>
        </div>
        <span className="ml-3 font-bold text-xl text-white">AllNads</span>
      </div>
      
      <div className="flex items-center">
        <div className="mr-4 font-medium text-white">
          {displayName}
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-[#8B5CF6] text-white font-bold uppercase rounded-xl border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6] transition-all"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
} 