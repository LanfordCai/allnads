"use client";
import { useState, useEffect } from 'react';
import { blockchainService } from '../services/blockchain';
import TemplateModal from './TemplateModal';

interface ImageCardProps {
  imageUrl?: string;
  alt?: string;
  title?: string;
  caption?: string;
  onChangeComponent?: (templateId: bigint, templateDetails?: any) => void;
  nftAccount?: string; // Token bound account address of the AllNads NFT
  templateId?: bigint; // Current template ID displayed in the card
}

export default function ImageCard({ 
  imageUrl = "/image-placeholder.jpg", 
  alt = "Featured Image",
  title,
  onChangeComponent,
  nftAccount,
  templateId
}: ImageCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOwned, setIsOwned] = useState(false);
  const [checkingOwnership, setCheckingOwnership] = useState(false);
  
  // 添加调试日志，记录 imageUrl 的变化
  useEffect(() => {
    console.log('ImageCard: imageUrl 已更新:', imageUrl ? imageUrl.substring(0, 50) + '...' : null);
  }, [imageUrl]);

  // Function to get the connected user's address
  const getUserAddress = async () => {
    return blockchainService.getUserAddress();
  };

  // Function to check if the NFT account owns this template
  useEffect(() => {
    console.log("ImageCard useEffect triggered with:", { 
      nftAccount, 
      templateId: templateId?.toString() 
    });
    
    const checkOwnership = async () => {
      // If templateId is missing, we can't check ownership
      if (!templateId) {
        console.log("Skipping ownership check - missing templateId");
        return;
      }
      
      // If nftAccount is missing, try to get the user's address
      let accountToCheck = nftAccount;
      if (!accountToCheck) {
        console.log("No nftAccount provided, attempting to get user address");
        const userAddress = await getUserAddress();
        if (!userAddress) {
          console.log("Could not get user address, skipping ownership check");
          return;
        }
        accountToCheck = userAddress;
        console.log("Using user wallet address for ownership check:", accountToCheck);
      }
      
      console.log(`Starting ownership check for account: ${accountToCheck}, templateId: ${templateId}`);
      setCheckingOwnership(true);
      try {
        // Check if the account owns this template
        const tokenId = await blockchainService.checkTemplateOwnership(accountToCheck, templateId);
        
        // If tokenId is greater than 0, the account owns this template
        const owned = tokenId > BigInt(0);
        console.log(`Ownership check result: ${owned ? 'Owned' : 'Not owned'}, tokenId: ${tokenId}`);
        setIsOwned(owned);
      } catch (error) {
        console.error('Error checking template ownership:', error);
        setIsOwned(false);
      } finally {
        setCheckingOwnership(false);
      }
    };
    
    checkOwnership();
  }, [nftAccount, templateId]);
  
  // Function to open modal
  // Templates are preloaded in the background when the app starts
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };
  
  // Function to close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  // Function to handle template selection
  const handleSelectTemplate = (templateId: bigint, templateDetails?: any) => {
    if (onChangeComponent) {
      onChangeComponent(templateId, templateDetails);
    }
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
      <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-100 relative">
        <img 
          src={imageUrl} 
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            // If image fails to load, show a placeholder
            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 300 300'%3E%3Crect fill='%23f0f0f0' width='300' height='300'/%3E%3Ctext fill='%23999999' font-family='Arial' font-size='14' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EImage%3C/text%3E%3C/svg%3E";
          }}
        />
      </div>

      {title && (
        <h3 className="px-1 pt-2 text-lg font-bold text-gray-700">{title}</h3>
      )}
      
      <button 
        onClick={handleOpenModal}
        className="mt-3 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
      >
        更换模板并发送消息
      </button>
      
      {/* Template Selection Modal - Templates are preloaded in the background */}
      <TemplateModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSelectTemplate={handleSelectTemplate}
        nftAccount={nftAccount}
      />
    </div>
  );
} 