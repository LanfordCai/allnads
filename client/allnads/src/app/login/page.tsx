"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { NFTService } from '../services/NFTService';
import Image from 'next/image';

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
        
        {/* Welcome Text */}
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">AllNads</h1>
        <p className="text-lg text-gray-600 mb-8 text-center">Degen AI Buddy for All</p>
        
        {/* Login Button or Loading */}
        <div className="grid grid-cols-1 gap-3">
          {isCheckingNFT ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#8B5CF6] mx-auto mb-4"></div>
              <p className="text-gray-600">Verifying NFT status...</p>
            </div>
          ) : (
            <button 
              onClick={() => login()}
              className="w-full py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] 
                hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]"
            >
              Start Now
            </button>
          )}
        </div>
        
        {/* Terms */}
        {/* <div className="mt-8 text-sm text-center text-gray-500">
          <p>
            By continuing, you agree to the{' '}
            <a href="#" className="text-[#8B5CF6] hover:underline font-medium">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-[#8B5CF6] hover:underline font-medium">Privacy Policy</a>
          </p>
        </div> */}
      </div>
    </div>
  );
} 