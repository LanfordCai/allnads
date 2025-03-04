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
  onSwitchToChat?: () => void; // 切换到聊天区域的回调函数
  isSmallScreen?: boolean; // 是否为小屏幕
}

export default function ImageCard({ 
  imageUrl = "/image-placeholder.jpg", 
  alt = "Featured Image",
  title,
  onChangeComponent,
  nftAccount,
  templateId,
  onSwitchToChat,
  isSmallScreen = false
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
    
    // 在小屏幕下自动切换到聊天区域
    if (isSmallScreen && onSwitchToChat) {
      // 短暂延迟，确保模态框已关闭
      setTimeout(() => {
        onSwitchToChat();
      }, 100);
    }
  };
  
  // 处理切换到聊天区域
  const handleSwitchToChat = () => {
    if (onSwitchToChat) {
      onSwitchToChat();
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden border-4 border-[#8B5CF6] mb-4">
      <div className="w-full aspect-square relative">
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

      <div className="p-4">
        {title && (
          <h3 className="text-lg font-bold text-gray-700 mb-3">{title}</h3>
        )}
        
        {/* 按钮区域 */}
        <div className="grid grid-cols-1 gap-3">
          {/* 在小屏幕上显示按钮组 */}
          {isSmallScreen && onSwitchToChat && (
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleSwitchToChat}
                className="py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                  bg-[#4CAF50] text-white border-4 border-[#388E3C] shadow-[4px_4px_0px_0px_#2E7D32] 
                  hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#2E7D32]"
              >
                切换到聊天
              </button>
              
              <button 
                onClick={handleOpenModal}
                className="py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                  bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] 
                  hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]"
              >
                更换模板
              </button>
            </div>
          )}
          
          {/* 在非小屏幕上或没有聊天切换功能时只显示更换模板按钮 */}
          {(!isSmallScreen || !onSwitchToChat) && (
            <button 
              onClick={handleOpenModal}
              className="w-full py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] 
                hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]"
            >
              更换模板
            </button>
          )}
        </div>
      </div>
      
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