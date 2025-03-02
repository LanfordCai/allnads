"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyAuth } from './hooks/usePrivyAuth';
import { NFTService } from './services/NFTService';

export default function Home() {
  const { isAuthenticated, isLoading, user } = usePrivyAuth();
  const router = useRouter();
  const [isCheckingNFT, setIsCheckingNFT] = useState(false);
  
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // If authenticated, check if the user has an NFT
        checkUserNFT();
      } else {
        // Not authenticated, redirect to login page
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Check if user has an NFT and redirect accordingly
  const checkUserNFT = async () => {
    if (user?.wallet?.address) {
      setIsCheckingNFT(true);
      try {
        const result = await NFTService.checkNFT(user.wallet.address);
        
        if (result.hasNFT) {
          // User has an NFT, redirect to app page
          router.push('/app');
        } else {
          // User doesn't have an NFT, redirect to airdrop page
          router.push('/airdrop');
        }
      } catch (error) {
        console.error('Error checking NFT status:', error);
        // In case of error, redirect to app page as fallback
        router.push('/app');
      } finally {
        setIsCheckingNFT(false);
      }
    } else {
      // If wallet address is not available, redirect to app page as fallback
      router.push('/app');
    }
  };

  // Display loading state
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 px-4">
      {/* Logo */}
      <div className="w-24 h-24 bg-black rounded-md flex items-center justify-center mb-6">
        <div className="w-12 h-12 bg-white rotate-45"></div>
      </div>
      
      <h1 className="text-4xl font-bold mb-2 text-center">AllNads</h1>
      <p className="text-xl text-gray-600 mb-8 text-center">Your Web3 Gateway</p>
      
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black mt-6"></div>
      <p className="mt-4 text-gray-500">
        {isCheckingNFT ? 'Checking NFT status...' : 'Loading...'}
      </p>
    </div>
  );
}
