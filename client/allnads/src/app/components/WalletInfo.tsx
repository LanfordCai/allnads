"use client";

import { usePrivyAuth } from '../hooks/usePrivyAuth';

interface WalletInfoProps {
  nftAccount?: string | null;
}

export default function WalletInfo({ nftAccount }: WalletInfoProps) {
  // Remove wallet address as we won't be using it
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-700">AllNads Account</h2>
      </div>
      
      {nftAccount ? (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-blue-700">
              {`${nftAccount.slice(0, 6)}...${nftAccount.slice(-4)}`}
            </span>
            <button 
              className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(nftAccount);
                // Could add a toast notification here
              }}
            >
              Copy
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
          <p className="text-sm text-yellow-700">
            No AllNads account found. Get an NFT to access your account.
          </p>
        </div>
      )}
      
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