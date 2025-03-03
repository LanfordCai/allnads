"use client";

import { useState } from 'react';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { useAllNads } from '../hooks/useAllNads';
import { useAccountBalance } from '../hooks/useAccountBalance';
import { Address } from 'viem';

// Define Monad Testnet chain
const monadChain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC || 'https://rpc.testnet.monad.xyz/'] }
  }
};

interface WalletInfoProps {
  nftAccount?: string | null;
}

type Tab = 'tokens' | 'nfts';

export default function WalletInfo({ nftAccount }: WalletInfoProps) {
  const { isAuthenticated } = usePrivyAuth();
  const [activeTab, setActiveTab] = useState<Tab>('tokens');
  const { balance, isLoading: isLoadingBalance } = useAccountBalance(nftAccount as Address);
  
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
        <p className="text-gray-500 text-sm mb-1">Account Balance</p>
        <div className="flex items-end">
          {isLoadingBalance ? (
            <div className="animate-pulse h-8 w-32 bg-gray-200 rounded"></div>
          ) : (
            <>
              <span className="text-3xl font-semibold">{Number(balance).toFixed(4)}</span>
              <span className="text-gray-400 text-lg ml-2">MON</span>
            </>
          )}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button 
          className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          disabled={!nftAccount}
        >
          Send
        </button>
        <button 
          className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          disabled={!nftAccount}
        >
          Swap
        </button>
        <button 
          className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          disabled={!nftAccount}
        >
          Top up
        </button>
      </div>
      
      {/* Tab switcher */}
      <div className="mb-6">
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-2 text-sm font-medium ${
              activeTab === 'tokens'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('tokens')}
          >
            Tokens
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium ${
              activeTab === 'nfts'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('nfts')}
          >
            NFTs
          </button>
        </div>
      </div>
      
      {/* Tab content */}
      <div className="space-y-4 max-h-48 overflow-y-auto">
        {activeTab === 'tokens' ? (
          <div className="space-y-3">
            {/* Token list */}
            <div className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">MON</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">Monad</p>
                    <p className="text-xs text-gray-500">Native Token</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{Number(balance).toFixed(4)}</p>
                  <p className="text-xs text-gray-500">MON</p>
                </div>
              </div>
            </div>
            {/* Add more tokens here */}
          </div>
        ) : (
          <div className="space-y-3">
            {/* NFT list */}
            <div className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-purple-600">AN</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">AllNads</p>
                    <p className="text-xs text-gray-500">Account NFT</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">#1</p>
                  <p className="text-xs text-gray-500">ID</p>
                </div>
              </div>
            </div>
            {/* Add more NFTs here */}
          </div>
        )}
      </div>
    </div>
  );
} 