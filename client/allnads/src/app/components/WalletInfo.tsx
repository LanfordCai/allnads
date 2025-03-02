"use client";

import { usePrivyAuth } from '../hooks/usePrivyAuth';

export default function WalletInfo() {
  const { user } = usePrivyAuth();
  const walletAddress = user?.wallet?.address;
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-700">Wallet</h2>
        <div className="text-sm text-gray-500">
          {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connecting...'}
        </div>
      </div>
      
      <div className="mb-8">
        <p className="text-gray-500 text-sm mb-1">Balance</p>
        <div className="flex items-end">
          <span className="text-gray-400 text-2xl mr-1">$</span>
          <span className="text-3xl font-semibold">0.00</span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
          <span className="text-sm font-medium mb-1">Send</span>
        </button>
        <button className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
          <span className="text-sm font-medium mb-1">Swap</span>
        </button>
        <button className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
          <span className="text-sm font-medium mb-1">Top up</span>
        </button>
      </div>
      
      <button className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors">
        Buy crypto
      </button>
    </div>
  );
} 