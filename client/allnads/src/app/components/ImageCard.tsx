"use client";
import { useState, useEffect } from 'react';
import TemplateModal from './TemplateModal';
import Image from 'next/image';
import { TemplateDetails } from '../types/template';

interface ImageCardProps {
  imageUrl?: string;
  alt?: string;
  title?: string;
  caption?: string;
  onChangeComponent?: (templateId: bigint, templateDetails?: TemplateDetails) => void;
  nftAccount?: string; // Token bound account address of the AllNads NFT
  templateId?: bigint; // Current template ID displayed in the card
  onSwitchToChat?: () => void; // Callback function to switch to chat area
  isSmallScreen?: boolean; // Whether it's a small screen
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
  
  // Add debug log to record imageUrl changes
  useEffect(() => {
    console.log('ImageCard: imageUrl updated:', imageUrl ? imageUrl.substring(0, 50) + '...' : null);
  }, [imageUrl]);

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
  const handleSelectTemplate = (templateId: bigint, templateDetails?: TemplateDetails) => {
    if (onChangeComponent) {
      onChangeComponent(templateId, templateDetails);
    }
    
    // Automatically switch to chat area on small screens
    if (isSmallScreen && onSwitchToChat) {
      // Short delay to ensure modal is closed
      setTimeout(() => {
        onSwitchToChat();
      }, 100);
    }
  };
  
  // Handle switching to chat area
  const handleSwitchToChat = () => {
    if (onSwitchToChat) {
      onSwitchToChat();
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden border-4 border-[#8B5CF6] mb-4">
      <div className="w-full aspect-square relative">
        <Image 
          src={imageUrl} 
          alt={alt}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
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
        
        {/* Button area */}
        <div className="grid grid-cols-1 gap-3">
          {/* Display button group on small screens */}
          {isSmallScreen && onSwitchToChat && (
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleSwitchToChat}
                className="py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                  bg-[#4CAF50] text-white border-4 border-[#388E3C] shadow-[4px_4px_0px_0px_#2E7D32] 
                  hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#2E7D32]"
              >
                Switch to Chat
              </button>
              
              <button 
                onClick={handleOpenModal}
                className="py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                  bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] 
                  hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]"
              >
                Change Component
              </button>
            </div>
          )}
          
          {/* Only display change component button on non-small screens or when chat switch function is not available */}
          {(!isSmallScreen || !onSwitchToChat) && (
            <button 
              onClick={handleOpenModal}
              className="w-full py-3 px-4 rounded-xl font-black text-center uppercase transition-all
                bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] 
                hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]"
            >
              Change Component
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