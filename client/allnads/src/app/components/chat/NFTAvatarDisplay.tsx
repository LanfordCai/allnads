"use client";

import { useState, useEffect } from 'react';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import ImageCard from '../ImageCard';
import { blockchainService } from '../../services/blockchain';
import { Template } from '../../types/template';
import Image from 'next/image';

// Define a type for template details that extends Template
interface TemplateDetails extends Partial<Template> {
  componentTypeName?: string;
  isOwned?: boolean;
}

interface NFTAvatarDisplayProps {
  isLoadingAvatar: boolean;
  avatarImage?: string | null;
  nftError: string | null;
  nftName?: string | null;
  tokenId: string | null;
  router: AppRouterInstance;
  nftAccount: string | null;
  onAvatarImageChange?: (avatarImage: string | null) => void;
  onSendMessage?: (message: string) => void;
  onSwitchToChat?: () => void;
  isSmallScreen?: boolean;
}

export function NFTAvatarDisplay({
  isLoadingAvatar,
  avatarImage: initialAvatarImage,
  nftError,
  nftName: initialNftName,
  tokenId,
  router,
  nftAccount,
  onAvatarImageChange,
  onSendMessage,
  onSwitchToChat,
  isSmallScreen = false
}: NFTAvatarDisplayProps) {
  const [avatarImage, setAvatarImage] = useState<string | null>(initialAvatarImage || null);
  const [nftName, setNftName] = useState<string | null>(initialNftName || null);
  const [, setError] = useState<string | null>(nftError);

  // Update parent component when avatar image changes
  useEffect(() => {
    if (onAvatarImageChange) {
      console.log('NFTAvatarDisplay: Notifying parent component avatarImage updated:', avatarImage ? avatarImage.substring(0, 50) + '...' : null);
      onAvatarImageChange(avatarImage);
    }
  }, [avatarImage, onAvatarImageChange]);

  // Update local state when initialAvatarImage prop changes
  useEffect(() => {
    console.log('NFTAvatarDisplay: initialAvatarImage updated:', initialAvatarImage ? initialAvatarImage.substring(0, 50) + '...' : null);
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
  const handleChangeComponent = (templateId: bigint, templateDetails?: TemplateDetails) => {
    console.log(`Selected template ID: ${templateId.toString()}`, templateDetails);
    
    // Send a message to the chat
    if (onSendMessage) {
      // Create a more detailed message with template information
      let message = `I've selected a new template!`;
      
      if (templateDetails) {
        const { name, componentTypeName, isOwned } = templateDetails;
        
        // Add template ID and name
        message += `\nTemplate ID: #${templateId.toString()}`;
        
        // Add template name if available
        if (name) {
          message += `\nName: ${name}`;
        }
        
        // Add component type if available
        if (componentTypeName) {
          message += `\nType: ${componentTypeName}`;
        }
        
        // Add ownership status
        message += `\nOwnership status: ${isOwned ? 'Owned ✅' : 'Not owned ❌'}`;
        
        // Add invitation
        message += `\n\nPlease try on this template!`;
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
          isSmallScreen={isSmallScreen}
          onSwitchToChat={onSwitchToChat}
        />
      </div>
    );
  }
  
  // No avatar state - show placeholder image without title
  return (
    <div className="mx-auto max-w-[320px] mt-4 mb-6">
      <div className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden border-4 border-[#8B5CF6] mb-4">
        <div className="w-full aspect-square relative">
          <Image 
            src="/placeholder.png" 
            alt="Placeholder Avatar"
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => router.push('/airdrop')}
              className="w-full py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] 
                hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]"
            >
              Get an NFT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 