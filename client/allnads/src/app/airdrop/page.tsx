"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { useIdentityToken } from '@privy-io/react-auth';
import { NFTService } from '../services/NFTService';
import AuthGuard from '../components/AuthGuard';
import AppHeader from '../components/AppHeader';
import Image from 'next/image';

export default function AirdropPage() {
  const { isAuthenticated, isLoading, user } = usePrivyAuth();
  const { identityToken } = useIdentityToken();
  const router = useRouter();
  const [isCheckingNFT, setIsCheckingNFT] = useState(false);
  const [hasNFT, setHasNFT] = useState(false);
  const [isRequestingAirdrop, setIsRequestingAirdrop] = useState(false);
  const [airdropStatus, setAirdropStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [nftName, setNftName] = useState('Cool Cool Nads');

  // Check if user already has NFT on initial load
  useEffect(() => {
    async function checkInitialNFTStatus() {
      if (isAuthenticated && user?.wallet?.address) {
        setIsCheckingNFT(true);
        try {
          const result = await NFTService.checkNFT(user.wallet.address);
          console.log('Initial NFT check result:', result);
          
          if (result.success && result.data) {
            setHasNFT(result.data.hasNFT);
            if (result.data.hasNFT) {
              setTimeout(() => {
                router.push('/app');
              }, 2000);
            }
          }
        } catch (error) {
          console.error('Error checking NFT:', error);
        } finally {
          setIsCheckingNFT(false);
        }
      }
    }

    if (!isLoading && isAuthenticated) {
      checkInitialNFTStatus();
    }
  }, [isAuthenticated, isLoading, user?.wallet?.address]);

  // Handle airdrop request
  const handleAirdropRequest = async () => {
    if (!isAuthenticated || !user?.wallet?.address) {
      setErrorMessage('You need to be authenticated with a wallet to claim the NFT.');
      return;
    }

    if (!identityToken) {
      setErrorMessage('Authentication token is not available. Please try again later.');
      return;
    }

    setIsRequestingAirdrop(true);
    setAirdropStatus('loading');
    setErrorMessage('');

    try {
      // Log identity token availability
      console.log('Using identity token for authentication:', identityToken ? 'Token available' : 'No token');
      
      console.log('Requesting airdrop for wallet address:', user.wallet.address);
      const result = await NFTService.airdropNFT(user.wallet.address, identityToken, nftName);
      
      if (result.success) {
        setAirdropStatus('success');
        
        // On successful airdrop request, show success message for 2 seconds then redirect to app
        console.log('NFT airdrop successful, redirecting to app page shortly');
        
        // Redirect after a short delay so user sees the success message
        setTimeout(() => {
          router.push('/app');
        }, 2000);
      } else {
        setAirdropStatus('error');
        setErrorMessage(result.message || 'Failed to receive airdrop. Please try again.');
      }
    } catch (error: unknown) {
      console.error('Error requesting airdrop:', error);
      setAirdropStatus('error');
      
      // Check for different error types
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        // Handle ApiResponse error format
        setErrorMessage((error as { message: string }).message);
      } else {
        setErrorMessage('Failed to request airdrop. Please try again later.');
      }
    } finally {
      setIsRequestingAirdrop(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex flex-col h-screen bg-gradient-to-b from-[#F9FAFB] to-[#F3F4F6]">
        <AppHeader />
        <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-xl shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden border-4 border-[#8B5CF6] p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-[#8B5CF6] rounded-xl mx-auto flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_#7C3AED] overflow-hidden border-4 border-[#7C3AED]">
                <Image 
                  src="/allnads.jpg" 
                  alt="AllNads Logo" 
                  width={80} 
                  height={80}
                  className="object-cover"
                />
              </div>
              <h1 className="text-3xl font-bold mb-2 text-gray-800">Hey, My Fren</h1>
              <p className="text-gray-600">Get your free AllNads to start</p>
            </div>

            {isCheckingNFT ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#8B5CF6] mx-auto mb-4"></div>
                <p className="text-gray-600">Checking AllNads status...</p>
              </div>
            ) : hasNFT ? (
              <div className="text-center py-6">
                <div className="bg-[#F3E8FF] text-[#7C3AED] p-4 rounded-xl border-2 border-[#D8B4FE] mb-6">
                  <p className="font-medium">You already have an AllNads!</p>
                  <p className="text-sm mt-2">Redirecting to chat...</p>
                </div>
                <button
                  onClick={() => router.push('/app')}
                  className="w-full py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                  bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] 
                  hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]"
                >
                  Go to Chat
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                {airdropStatus === 'error' && (
                  <div className="bg-[#FEE2E2] text-[#B91C1C] p-4 rounded-xl border-2 border-[#FCA5A5] mb-6">
                    <p>{errorMessage}</p>
                  </div>
                )}

                {airdropStatus === 'success' && (
                  <div className="bg-[#F3E8FF] text-[#7C3AED] p-4 rounded-xl border-2 border-[#D8B4FE] mb-6">
                    <p className="font-medium">AllNads airdrop requested successfully!</p>
                    <p className="text-sm mt-2">Redirecting to chat application...</p>
                  </div>
                )}

                <div className="mb-6">
                  <label htmlFor="nft-name" className="block text-sm font-medium text-gray-700 text-left mb-1">
                    AllNads Name
                  </label>
                  <input
                    type="text"
                    id="nft-name"
                    value={nftName}
                    onChange={(e) => setNftName(e.target.value)}
                    placeholder="Enter a name for your NFT"
                    className="w-full px-4 py-2 border-2 border-[#D8B4FE] rounded-xl outline-none focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-[#8B5CF6]"
                    maxLength={50}
                    disabled={isRequestingAirdrop}
                  />
                  <p className="mt-1 text-xs text-gray-500 text-left">
                    {nftName.length}/50 characters
                  </p>
                </div>

                <button
                  onClick={handleAirdropRequest}
                  disabled={isRequestingAirdrop || !nftName.trim()}
                  className={`w-full py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                    text-white border-4 ${
                    isRequestingAirdrop || !nftName.trim()
                      ? 'bg-gray-400 border-gray-500 shadow-[4px_4px_0px_0px_#9CA3AF] cursor-not-allowed' 
                      : 'bg-[#8B5CF6] border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]'
                  }`}
                >
                  {isRequestingAirdrop ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⟳</span>
                      Requesting Airdrop...
                    </>
                  ) : (
                    'Claim Your AllNads'
                  )}
                </button>

                {user?.wallet?.address && (
                  <div className="mt-4 text-sm text-gray-500">
                    Wallet: {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
} 