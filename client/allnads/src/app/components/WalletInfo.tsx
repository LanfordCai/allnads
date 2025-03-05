"use client";

import { useState } from 'react';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { useAccountBalance } from '../hooks/useAccountBalance';
import { Address } from 'viem';
import { useNotification } from '../contexts/NotificationContext';
import { useFundWallet } from '@privy-io/react-auth';
import AddressBookModal from './AddressBookModal';

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

export default function WalletInfo({ nftAccount }: WalletInfoProps) {
  const { user } = usePrivyAuth();
  const [, setShowTokensModal] = useState(false);
  const [showAddressBookModal, setShowAddressBookModal] = useState(false);
  const { showNotification } = useNotification();
  const { fundWallet } = useFundWallet();
  const { balance, isLoading: isLoadingBalance } = useAccountBalance(nftAccount as Address);

  // Get user wallet address
  const walletAddress = user?.wallet?.address;
  const { balance: privyWalletBalance } = useAccountBalance(walletAddress as Address);

  const topUpWallet = async (walletAddress: Address) => {
    await fundWallet(walletAddress, {
      chain: monadChain,
      amount: "1",
      asset: "native-currency",
      defaultFundingMethod: "wallet",
    });
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
                  showNotification("Address copied to clipboard", "success");
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
                  isLoadingBalance ?
                    <div className="h-8 w-32 bg-[#EDE9FE] rounded"></div> :
                    <div className="flex items-end">
                      <span className="text-2xl font-bold text-[#5B21B6]">{Number(balance).toFixed(4)}</span>
                      <span className="text-[#8B5CF6] text-base ml-2">MON</span>
                    </div>
                }
                <button
                  onClick={() => setShowTokensModal(true)}
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
            >
              Send
            </button>
            <button
              className={`p-2 rounded-lg text-sm font-medium transition-all ${!nftAccount
                ? 'bg-purple-100 text-purple-300 cursor-not-allowed'
                : 'bg-[#F3F0FF] text-[#6D28D9] hover:bg-[#EDE9FE] border border-[#C4B5FD]'
                }`}
              disabled={!nftAccount}
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
            onClick={() => setShowAddressBookModal(true)}
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
                  // Could add a toast notification here
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
                  isLoadingBalance ?
                    <div className="h-8 w-32 bg-[#EDE9FE] rounded"></div> :
                    <div className="flex items-end">
                      <span className="text-2xl font-bold text-[#5B21B6]">{Number(privyWalletBalance).toFixed(4)}</span>
                      <span className="text-[#8B5CF6] text-base ml-2">MON</span>
                    </div>
                }
                <button
                  className={`py-2 px-5 rounded-lg text-sm font-medium transition-all ${!walletAddress
                    ? 'bg-purple-100 text-purple-300 cursor-not-allowed'
                    : 'bg-[#F3F0FF] text-[#6D28D9] hover:bg-[#EDE9FE] border border-[#C4B5FD]'
                    }`}
                  disabled={!walletAddress}
                  onClick={() => topUpWallet(walletAddress as Address)}
                >
                  Top Up
                </button>
              </>
            </div>
          </div>

          <div className="p-3 bg-[#F9F7FF] rounded-lg border border-[#C4B5FD] text-sm">
            <p className="text-[#6D28D9]">
              <span className="font-medium">Note:</span> <span className="text-red-600">AllNads Account transaction fees are paid from this wallet.</span> This wallet is also the holder of your AllNads NFT.
            </p>
          </div>
        </div>
      </div>

      {/* Address Book Modal */}
      <AddressBookModal 
        isOpen={showAddressBookModal}
        onClose={() => setShowAddressBookModal(false)}
        nftAccount={nftAccount}
      />

      {/* Token Modal would be implemented here */}
    </div>
  );
} 