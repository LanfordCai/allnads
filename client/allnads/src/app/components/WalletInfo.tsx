"use client";

import { useState } from 'react';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { useAccountBalance } from '../hooks/useAccountBalance';
import { Address } from 'viem';
import { useNotification } from '../contexts/NotificationContext';
import { useFundWallet, useWallets, useDelegatedActions } from '@privy-io/react-auth';

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
  onSendMessage?: (message: string) => void;
}

export default function WalletInfo({ nftAccount, onSendMessage }: WalletInfoProps) {
  const { user } = usePrivyAuth();
  const [, setShowTokensModal] = useState(false);
  const { showNotification } = useNotification();
  const { fundWallet } = useFundWallet();
  const { balance } = useAccountBalance(nftAccount as Address);
  const { wallets } = useWallets();
  const { delegateWallet, revokeWallets } = useDelegatedActions();

  // Get user wallet address
  const walletAddress = user?.wallet?.address;
  const { balance: privyWalletBalance } = useAccountBalance(walletAddress as Address);
  
  // Check if the wallet is already delegated
  const isWalletDelegated = !!user?.linkedAccounts?.find(
    (account) => account.type === 'wallet' && 'delegated' in account && account.delegated
  );

  const topUpWallet = async (walletAddress: Address) => {
    await fundWallet(walletAddress, {
      chain: monadChain,
      amount: "1",
      asset: "native-currency",
      defaultFundingMethod: "wallet",
    });
  };

  const handleTokensClick = () => {
    // Send message to ChatArea
    if (onSendMessage) {
      onSendMessage("Show me the tokens you have.");
    }
    setShowTokensModal(true);
  };

  const handleSendClick = () => {
    // Send message to ChatArea when Send button is clicked
    if (onSendMessage) {
      onSendMessage("I want to transfer some tokens");
    }
  };

  const handleSwapClick = () => {
    // Send message to ChatArea when Swap button is clicked
    if (onSendMessage) {
      onSendMessage("Let's do a swap!");
    }
  };

  const handleAddressBookClick = () => {
    if (onSendMessage) {
      onSendMessage("Show me the address book");
    }
  };

  const handleDelegateClick = async () => {
    try {
      // Find the embedded wallet
      const embeddedWallet = wallets.find(wallet => 
        wallet.walletClientType === 'privy'
      );
      
      if (!embeddedWallet) {
        showNotification("No embedded wallet found to delegate from", "error");
        return;
      }
      
      // Check if the wallet is already delegated
      const isAlreadyDelegated = !!user?.linkedAccounts?.find(
        (account) => account.type === 'wallet' && 'delegated' in account && account.delegated
      );
      
      if (isAlreadyDelegated) {
        try {
          // Revoke all delegated wallets
          await revokeWallets();
          showNotification("Successfully revoked delegation from AllNads", "success");
        } catch (error) {
          console.error("Undelegation error:", error);
          showNotification("Failed to revoke delegation. Please try again.", "error");
        }
        return;
      }
      
      // Delegate the wallet using the delegateWallet method
      await delegateWallet({
        address: embeddedWallet.address,
        chainType: 'ethereum'
      });
      
      showNotification("Successfully delegated transaction signing to AllNads", "success");
    } catch (error) {
      console.error("Delegation error:", error);
      showNotification("Failed to delegate. Please try again.", "error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-y-6 w-full">
      {/* AllNads Account Section */}
      <div className="bg-white rounded-xl border-4 border-[#8B5CF6] shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden w-full max-w-[320px] relative">
        <div className="absolute top-3 left-3">
          <span className="bg-[#6dbc70] text-white text-xs font-medium px-3 py-1 rounded-full">
            {`AllNads Account (NFT Account)`}
          </span>
        </div>

        <div className="p-4 pt-12">
          {nftAccount && (
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[#6D28D9] text-sm">
                {`${nftAccount.slice(0, 10)}...${nftAccount.slice(-8)}`}
              </span>
              <button
                className="p-1.5 text-[#8B5CF6] hover:bg-[#F3F0FF] rounded-md transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(nftAccount);
                  // Could add a toast notification here
                  showNotification("AllNads Account copied to clipboard", "success");
                }}
                aria-label="Copy address"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              </button>
            </div>
          )}

          {!nftAccount && (
            <div className="mb-4 p-3 bg-[#FEF3C7] rounded-lg border border-[#FCD34D] text-sm">
              <p className="text-[#92400E]">
                No AllNads account found. Get an NFT to access your account.
              </p>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-end justify-between">
              <>
                {
                    <div className="flex items-end">
                      <span className="text-2xl font-bold text-[#5B21B6]">{Number(balance).toFixed(4)}</span>
                      <span className="text-[#8B5CF6] text-base ml-2">MON</span>
                    </div>
                }
                <button
                  onClick={handleTokensClick}
                  className={`py-1.5 px-3 rounded-lg font-bold text-sm transition-all
                      ${!nftAccount
                      ? 'bg-purple-200 text-purple-400 cursor-not-allowed'
                      : 'bg-[#8B5CF6] text-white border-2 border-[#7C3AED] shadow-[2px_2px_0px_0px_#5B21B6] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#5B21B6]'
                    }
                    `}
                  disabled={!nftAccount}
                >
                  Tokens
                </button>
              </>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <button
              className={`p-2 rounded-lg text-sm font-medium transition-all ${!nftAccount
                ? 'bg-purple-100 text-purple-300 cursor-not-allowed'
                : 'bg-[#F3F0FF] text-[#6D28D9] hover:bg-[#EDE9FE] border border-[#C4B5FD]'
                }`}
              disabled={!nftAccount}
              onClick={handleSendClick}
            >
              Send
            </button>
            <button
              className={`p-2 rounded-lg text-sm font-medium transition-all ${!nftAccount
                ? 'bg-purple-100 text-purple-300 cursor-not-allowed'
                : 'bg-[#F3F0FF] text-[#6D28D9] hover:bg-[#EDE9FE] border border-[#C4B5FD]'
                }`}
              disabled={!nftAccount}
              onClick={handleSwapClick}
            >
              Swap
            </button>
            <button
              className={`p-2 rounded-lg text-sm font-medium transition-all ${!nftAccount
                ? 'bg-purple-100 text-purple-300 cursor-not-allowed'
                : 'bg-[#F3F0FF] text-[#6D28D9] hover:bg-[#EDE9FE] border border-[#C4B5FD]'
                }`}
              disabled={!nftAccount}
              onClick={() => topUpWallet(nftAccount as Address)}
            >
              Top Up
            </button>
          </div>

          {/* Address Book button - styled like the Change Component button in ImageCard */}
          <button 
            onClick={handleAddressBookClick}
            className={`w-full py-2 px-4 rounded-lg font-bold text-sm mb-1 transition-all
              ${!nftAccount
                ? 'bg-purple-200 text-purple-400 cursor-not-allowed'
                : 'bg-[#8B5CF6] text-white border-2 border-[#7C3AED] shadow-[2px_2px_0px_0px_#5B21B6] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#5B21B6]'
              }`}
            disabled={!nftAccount}
          >
            Address Book
          </button>
        </div>
      </div>

      {/* Privy Linked Wallet Section */}
      <div className="bg-white rounded-xl border-4 border-[#8B5CF6] shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden w-full max-w-[320px] relative">
        <div className="absolute top-3 left-3">
          <span className="bg-[#6dbc70] text-white text-xs font-medium px-3 py-1 rounded-full">
            Privy Linked Wallet
          </span>
        </div>
        
        {/* Delegation status label */}
        <div className="absolute top-3 right-3">
          {walletAddress && (
            <span className={`text-white text-xs font-medium px-3 py-1 rounded-full ${isWalletDelegated ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}>
              {isWalletDelegated ? 'Delegated' : 'Not Delegated'}
            </span>
          )}
        </div>

        <div className="p-4 pt-12">
          {walletAddress && (
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[#6D28D9] text-sm">
                {`${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}`}
              </span>
              <button
                className="p-1.5 text-[#8B5CF6] hover:bg-[#F3F0FF] rounded-md transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(walletAddress);
                  // Show notification when address is copied
                  showNotification("Privy Wallet Address copied to clipboard", "success");
                }}
                aria-label="Copy address"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              </button>
            </div>
          )}

          {!walletAddress && (
            <div className="mb-4 p-3 bg-[#FEF3C7] rounded-lg border border-[#FCD34D] text-sm">
              <p className="text-[#92400E]">
                No wallet connected. Please connect a wallet.
              </p>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-end justify-between">
              <>
                {
                    <div className="flex items-end">
                      <span className="text-2xl font-bold text-[#5B21B6]">{Number(privyWalletBalance).toFixed(4)}</span>
                      <span className="text-[#8B5CF6] text-base ml-2">MON</span>
                    </div>
                }
                <button
                  className={`py-2 px-5 rounded-lg text-sm font-medium transition-all ${!walletAddress || !nftAccount
                    ? 'bg-purple-100 text-purple-300 cursor-not-allowed'
                    : 'bg-[#F3F0FF] text-[#6D28D9] hover:bg-[#EDE9FE] border border-[#C4B5FD]'
                    }`}
                  disabled={!walletAddress || !nftAccount}
                  onClick={() => topUpWallet(walletAddress as Address)}
                >
                  Top Up
                </button>
              </>
            </div>
          </div>

          {/* Delegate button - styled like the Address Book button but with green color */}
          <button 
            onClick={handleDelegateClick}
            className={`w-full py-2 px-4 rounded-lg font-bold text-sm mb-3 transition-all
              ${!walletAddress
                ? 'bg-green-200 text-green-400 cursor-not-allowed'
                : isWalletDelegated 
                  ? 'bg-[#ef4444] text-white border-2 border-[#dc2626] shadow-[2px_2px_0px_0px_#b91c1c] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#b91c1c]'
                  : 'bg-[#22c55e] text-white border-2 border-[#16a34a] shadow-[2px_2px_0px_0px_#15803d] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#15803d]'
              }`}
            disabled={!walletAddress}
          >
            {isWalletDelegated ? 'Undelegate' : 'Delegate'}
          </button>

          <div className="p-3 bg-[#F9F7FF] rounded-lg border border-[#C4B5FD] text-sm">
            <p className="text-[#6D28D9]">
              <span className="font-medium">Note:</span> <span className="text-red-600">AllNads Account transaction fees are paid from this wallet.</span> This wallet is also the holder of your AllNads NFT.
            </p>
            {!nftAccount && (
              <p className="mt-2 text-red-600 font-medium">You need an NFT to use wallet features.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 