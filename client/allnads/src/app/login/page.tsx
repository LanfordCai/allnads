"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { NFTService } from '../services/NFTService';

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, user } = usePrivyAuth();
  const router = useRouter();
  const [isCheckingNFT, setIsCheckingNFT] = useState(false);

  // Check NFT status and redirect to appropriate page
  useEffect(() => {
    async function checkNFTAndRedirect() {
      if (isAuthenticated && !isLoading && user?.wallet?.address) {
        setIsCheckingNFT(true);
        try {
          console.log('Checking NFT status for user:', user.wallet.address);
          const result = await NFTService.checkNFT(user.wallet.address);
          console.log('Login page NFT check result:', result);
          
          // Check if API call was successful and data exists
          if (result.success && result.data) {
            // If user has an NFT, redirect to app page
            if (result.data.hasNFT) {
              console.log('User has an NFT, redirecting to app page');
              router.push('/app');
            } else {
              // If user doesn't have an NFT, redirect to airdrop page
              console.log('User does not have an NFT, redirecting to airdrop page');
              router.push('/airdrop');
            }
          } else {
            console.error('API call successful but no data or unsuccessful response:', result);
            // On error or missing data, default to airdrop page
            router.push('/airdrop');
          }
        } catch (error) {
          console.error('Error checking NFT status:', error);
          // On error, default to airdrop page
          router.push('/airdrop');
        } finally {
          setIsCheckingNFT(false);
        }
      }
    }

    if (isAuthenticated && !isLoading) {
      checkNFTAndRedirect();
    }
  }, [isAuthenticated, isLoading, user?.wallet?.address, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 px-4">
      {/* Logo */}
      <div className="w-24 h-24 bg-black rounded-md flex items-center justify-center mb-6">
        <div className="w-12 h-12 bg-white rotate-45"></div>
      </div>
      
      {/* Welcome Text */}
      <h1 className="text-4xl font-bold mb-2 text-center">AllNads</h1>
      <p className="text-xl text-gray-600 mb-12 text-center">Your Web3 Gateway</p>
      
      {/* Login Button or Loading */}
      {isCheckingNFT ? (
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying NFT status...</p>
        </div>
      ) : (
        <button 
          onClick={() => login()}
          className="px-8 py-4 bg-black text-white text-lg font-medium rounded-full hover:bg-gray-900 transition-colors shadow-lg"
        >
          Start Now
        </button>
      )}
      
      {/* Terms */}
      <div className="mt-12 text-sm text-center text-gray-500 max-w-md">
        <p>
          By continuing, you agree to the{' '}
          <a href="#" className="underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
} 