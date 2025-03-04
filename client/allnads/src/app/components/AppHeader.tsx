"use client";

import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { useEffect, useState } from 'react';

export default function AppHeader() {
  const { user, logout } = usePrivyAuth();
  const [isMobile, setIsMobile] = useState(false);
  
  // 检测屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // 小于768px视为小屏幕
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
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
        {/* 在非移动设备上显示邮箱 */}
        {!isMobile && (
          <div className="mr-4 font-medium text-white">
            {displayName}
          </div>
        )}
        <button
          onClick={logout}
          className="p-2 bg-[#8B5CF6] text-white font-bold rounded-xl border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6] transition-all"
          title="Sign Out"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </header>
  );
} 