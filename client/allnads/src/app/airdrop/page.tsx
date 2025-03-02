"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { useIdentityToken } from '@privy-io/react-auth';
import { NFTService } from '../services/NFTService';
import AuthGuard from '../components/AuthGuard';
import AppHeader from '../components/AppHeader';

export default function AirdropPage() {
  const { isAuthenticated, isLoading, user } = usePrivyAuth();
  const { identityToken } = useIdentityToken();
  const router = useRouter();
  const [isCheckingNFT, setIsCheckingNFT] = useState(false);
  const [hasNFT, setHasNFT] = useState(false);
  const [isRequestingAirdrop, setIsRequestingAirdrop] = useState(false);
  const [airdropStatus, setAirdropStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [nftName, setNftName] = useState('AllNads Avatar');

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
    } catch (error: any) {
      console.error('Error requesting airdrop:', error);
      setAirdropStatus('error');
      setErrorMessage(error.message || 'Failed to request airdrop. Please try again later.');
    } finally {
      setIsRequestingAirdrop(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex flex-col h-screen bg-gray-50">
        <AppHeader />
        <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-black rounded-full mx-auto flex items-center justify-center mb-6">
                <div className="w-10 h-10 bg-white rotate-45"></div>
              </div>
              <h1 className="text-3xl font-bold mb-2">AllNads NFT Airdrop</h1>
              <p className="text-gray-600">Get your free AllNads NFT to start chatting with our AI bot.</p>
            </div>

            {isCheckingNFT ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black mx-auto mb-4"></div>
                <p className="text-gray-600">Checking NFT status...</p>
              </div>
            ) : hasNFT ? (
              <div className="text-center py-6">
                <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-6">
                  <p className="font-medium">You already have an AllNads NFT!</p>
                  <p className="text-sm mt-2">Redirecting to chat...</p>
                </div>
                <button
                  onClick={() => router.push('/app')}
                  className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors"
                >
                  Go to Chat
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                {airdropStatus === 'error' && (
                  <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-6">
                    <p>{errorMessage}</p>
                  </div>
                )}

                {airdropStatus === 'success' && (
                  <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-6">
                    <p className="font-medium">NFT airdrop requested successfully!</p>
                    <p className="text-sm mt-2">Redirecting to chat application...</p>
                  </div>
                )}

                <div className="mb-6">
                  <label htmlFor="nft-name" className="block text-sm font-medium text-gray-700 text-left mb-1">
                    NFT Name
                  </label>
                  <input
                    type="text"
                    id="nft-name"
                    value={nftName}
                    onChange={(e) => setNftName(e.target.value)}
                    placeholder="Enter a name for your NFT"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
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
                  className={`w-full py-3 text-white rounded-lg transition-colors ${
                    isRequestingAirdrop || !nftName.trim()
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-black hover:bg-gray-900'
                  }`}
                >
                  {isRequestingAirdrop ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⟳</span>
                      Requesting Airdrop...
                    </>
                  ) : (
                    'Claim Your NFT'
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