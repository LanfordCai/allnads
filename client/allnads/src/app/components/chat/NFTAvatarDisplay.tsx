"use client";

import { useState, useEffect } from 'react';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import ImageCard from '../ImageCard';
import { User } from '@privy-io/react-auth';
import { blockchainService } from '../../services/blockchain';

interface NFTAvatarDisplayProps {
  isLoadingAvatar: boolean;
  avatarImage?: string | null;
  nftError: string | null;
  nftName?: string | null;
  tokenId: string | null;
  isAuthenticated: boolean;
  user: User | null;
  router: AppRouterInstance;
  nftAccount: string | null;
  onAvatarImageChange?: (avatarImage: string | null) => void;
  onSendMessage?: (message: string) => void;
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
  nftAccount,
  onAvatarImageChange,
  onSendMessage
}: NFTAvatarDisplayProps) {
  const [avatarImage, setAvatarImage] = useState<string | null>(initialAvatarImage || null);
  const [nftName, setNftName] = useState<string | null>(initialNftName || null);
  const [error, setError] = useState<string | null>(nftError);

  // Update parent component when avatar image changes
  useEffect(() => {
    if (onAvatarImageChange) {
      console.log('NFTAvatarDisplay: 通知父组件 avatarImage 已更新:', avatarImage ? avatarImage.substring(0, 50) + '...' : null);
      onAvatarImageChange(avatarImage);
    }
  }, [avatarImage, onAvatarImageChange]);

  // Update local state when initialAvatarImage prop changes
  useEffect(() => {
    console.log('NFTAvatarDisplay: initialAvatarImage 已更新:', initialAvatarImage ? initialAvatarImage.substring(0, 50) + '...' : null);
    if (initialAvatarImage) {
      setAvatarImage(initialAvatarImage);
    }
  }, [initialAvatarImage]);

  // Fetch token image and name if tokenId is available
  useEffect(() => {
    if (tokenId && !isLoadingAvatar) {
      fetchTokenImage(tokenId);
    }
  }, [tokenId, isLoadingAvatar]);

  // Function to fetch token image and name
  const fetchTokenImage = async (tokenId: string) => {
    try {
      const result = await blockchainService.fetchTokenImageAndName(tokenId);
      
      if (result.name) {
        setNftName(result.name);
        console.log("NFT name:", result.name);
      }
      
      if (result.image) {
        setAvatarImage(result.image);
      } else {
        setError("NFT metadata doesn't contain an image");
      }
    } catch (error) {
      console.error('Error fetching token image:', error);
      setError("Failed to load NFT image");
    }
  };

  // Handle component change and send a message to the chat
  const handleChangeComponent = (templateId: bigint, templateDetails?: any) => {
    console.log(`Selected template ID: ${templateId.toString()}`, templateDetails);
    
    // Send a message to the chat
    if (onSendMessage) {
      // Create a more detailed message with template information
      let message = `我选择了一个新模板！`;
      
      if (templateDetails) {
        const { name, componentTypeName, isOwned } = templateDetails;
        
        // Add template ID and name
        message += `\n模板ID: #${templateId.toString()}`;
        
        // Add template name if available
        if (name) {
          message += `\n名称: ${name}`;
        }
        
        // Add component type if available
        if (componentTypeName) {
          message += `\n类型: ${componentTypeName}`;
        }
        
        // Add ownership status
        message += `\n拥有状态: ${isOwned ? '已拥有 ✅' : '未拥有 ❌'}`;
        
        // Add invitation
        message += `\n\n请你也换上这个模板吧！`;
      }
      
      onSendMessage(message);
    }
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
      <div className="mx-auto max-w-[320px] mt-4 mb-6">
        <ImageCard 
          imageUrl={avatarImage} 
          alt="Your AllNads Avatar"
          title={nftName || "Your AllNads NFT"}
          onChangeComponent={handleChangeComponent}
          nftAccount={nftAccount || undefined}
          templateId={tokenId ? BigInt(tokenId) : undefined}
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