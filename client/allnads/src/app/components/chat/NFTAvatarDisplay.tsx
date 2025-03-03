"use client";

import { useState, useEffect } from 'react';
import { createPublicClient, http, Address } from 'viem';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import ImageCard from '../ImageCard';
import AllNadsABI from '../../contracts/AllNads.json';
import { User } from '@privy-io/react-auth';

// Define Monad Testnet chain
const monadChain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC || 'https://rpc.testnet.monad.xyz/'] }
  }
};

// Contract address for AllNads
const ALLNADS_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as string;

interface NFTAvatarDisplayProps {
  isLoadingAvatar: boolean;
  avatarImage?: string | null;
  nftError: string | null;
  nftName?: string | null;
  tokenId: string | null;
  isAuthenticated: boolean;
  user: User | null;
  router: AppRouterInstance;
  onAvatarImageChange?: (avatarImage: string | null) => void;
}

export function NFTAvatarDisplay({
  isLoadingAvatar,
  avatarImage: initialAvatarImage,
  nftError,
  nftName: initialNftName,
  tokenId,
  isAuthenticated,
  user,
  router,
  onAvatarImageChange
}: NFTAvatarDisplayProps) {
  const [avatarImage, setAvatarImage] = useState<string | null>(initialAvatarImage || null);
  const [nftName, setNftName] = useState<string | null>(initialNftName || null);
  const [error, setError] = useState<string | null>(nftError);

  // Update parent component when avatar image changes
  useEffect(() => {
    if (onAvatarImageChange) {
      onAvatarImageChange(avatarImage);
    }
  }, [avatarImage, onAvatarImageChange]);

  // Fetch token image and name if tokenId is available
  useEffect(() => {
    if (tokenId && !isLoadingAvatar) {
      fetchTokenImage(tokenId);
    }
  }, [tokenId, isLoadingAvatar]);

  // Function to fetch token image and name
  const fetchTokenImage = async (tokenId: string) => {
    try {
      // Create public client
      const publicClient = createPublicClient({
        chain: monadChain,
        transport: http(),
      });
      
      // Get token URI
      const tokenURI = await publicClient.readContract({
        address: ALLNADS_CONTRACT_ADDRESS as Address,
        abi: AllNadsABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      }) as string;
      
      // Parse tokenURI (it's likely base64 encoded JSON)
      const jsonData = tokenURI.replace('data:application/json,', '');
      
      try {
        const json = JSON.parse(jsonData);
        
        // Extract name from tokenURI 
        if (json.name) {
          setNftName(json.name);
          console.log("NFT name:", json.name);
        }
        
        // Extract image from tokenURI (which is also base64 encoded)
        if (json.image) {
          setAvatarImage(json.image);
        } else {
          setError("NFT metadata doesn't contain an image");
        }
      } catch (parseError) {
        console.error("Error parsing NFT metadata:", parseError);
        setError("Invalid NFT metadata format");
      }
    } catch (error) {
      console.error('Error fetching token image:', error);
      setError("Failed to load NFT image");
    }
  };

  // Handle component change (just log for now)
  const handleChangeComponent = (templateId: bigint) => {
    console.log(`Selected template ID: ${templateId.toString()}`);
    // In a real implementation, this would call an API to update the NFT
  };

  if (isLoadingAvatar) {
    return (
      <div className="mx-auto text-center mt-4 mb-6">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Loading your AllNads NFT...</p>
      </div>
    );
  }
  
  if (avatarImage) {
    return (
      <div className="mx-auto max-w-xs mt-4 mb-6">
        <ImageCard 
          imageUrl={avatarImage} 
          alt="Your AllNads Avatar"
          title={nftName || "Your AllNads NFT"}
          onChangeComponent={handleChangeComponent}
        />
      </div>
    );
  }
  
  // No avatar state (could be due to error or not loaded yet)
  if (isAuthenticated && user?.wallet?.address) {
    return (
      <div className="mx-auto max-w-xs mt-4 mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-sm text-yellow-700 text-center">
          {error || nftError || "Unable to load your NFT avatar. Please refresh or check if your NFT exists."}
        </p>
        <button 
          onClick={() => router.push('/airdrop')} 
          className="mt-2 w-full py-2 px-4 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
        >
          Get an NFT
        </button>
      </div>
    );
  }
  
  return null;
} 