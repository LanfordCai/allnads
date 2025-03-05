"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyAuth } from './hooks/usePrivyAuth';
import { NFTService } from './services/NFTService';
import Image from 'next/image';
import Footer from './components/Footer';

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
        
        if (result.data?.hasNFT) {
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#F9FAFB] to-[#F3F4F6] px-4">
      <div className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden border-4 border-[#8B5CF6] w-full max-w-md p-8">
        {/* Logo */}
        <div className="w-24 h-24 bg-[#8B5CF6] rounded-xl flex items-center justify-center mb-6 mx-auto shadow-[4px_4px_0px_0px_#7C3AED] overflow-hidden border-4 border-[#7C3AED]">
          <Image 
            src="/allnads.jpg" 
            alt="AllNads Logo" 
            width={96} 
            height={96}
            className="object-cover"
          />
        </div>
        
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">AllNads</h1>
        <p className="text-lg text-gray-600 mb-8 text-center">Degen AI Buddy for All</p>
        
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#8B5CF6] mt-6"></div>
          <p className="mt-4 text-gray-500">
            {isCheckingNFT ? 'Checking NFT status...' : 'Loading...'}
          </p>
        </div>
        
        <Footer className="mt-8" />
      </div>
    </div>
  );
}
