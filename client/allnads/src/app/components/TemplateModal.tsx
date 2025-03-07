"use client";
import { useState, useEffect } from 'react';
import { blockchainService, Template } from '../services/blockchain';
import Image from 'next/image';
import { TemplateDetails } from '../types/template';
import { useTemplateOwnership } from '../hooks/useTemplateOwnership';

// Define component types matching the enum in the contract
const COMPONENT_TYPES = {
  BACKGROUND: 0,
  HAIRSTYLE: 1,
  EYES: 2,
  MOUTH: 3,
  ACCESSORY: 4
};

// PNG header constant
const PNG_HEADER = "iVBORw0KGgoAAAANSUhEUgAA";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: bigint, templateDetails?: TemplateDetails) => void;
  nftAccount?: string; // Token bound account address of the AllNads NFT
}

export default function TemplateModal({ 
  isOpen, 
  onClose, 
  onSelectTemplate,
  nftAccount
}: TemplateModalProps) {
  const [templates, setTemplates] = useState<{[key: string]: Template[]}>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("BACKGROUND");
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  
  // Use the template ownership hook instead of local state
  const { 
    ownedTemplates, 
    isLoading: checkingOwnership, 
    checkOwnership
  } = useTemplateOwnership();
  
  // Function to check if NFT account owns templates
  const checkTemplateOwnership = async (nftAccountAddress: string, forceRefresh: boolean = false) => {
    if (!nftAccountAddress) {
      return;
    }
    
    await checkOwnership(nftAccountAddress, forceRefresh);
  };
  
  // Function to get the connected user's address
  const getUserAddress = async () => {
    return blockchainService.getUserAddress();
  };
  
  // Function to load all templates
  const loadAllTemplates = async () => {
    if (templatesLoaded && Object.keys(templates).length > 0) {
      return;
    }
    
    setLoading(true);
    try {
      // Fetch all templates from the API in a single request
      const templatesByType = await blockchainService.fetchAllTemplatesFromAPI();
      // Update the templates state with the fetched data
      setTemplates(templatesByType);
      
      console.log("All templates loaded successfully");
      setTemplatesLoaded(true);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Load templates and check ownership when component mounts or nftAccount changes
  useEffect(() => {
    const initializeData = async () => {
      if (nftAccount) {
        // Load templates
        await loadAllTemplates();
        await checkTemplateOwnership(nftAccount);
      } else {
        const address = await getUserAddress();
        if (address) {
          // Load templates
          await loadAllTemplates();
          // Check template ownership using user's wallet address
          await checkTemplateOwnership(address);
        } else {
          console.log("No user address found, cannot check template ownership");
        }
      }
    };
    
    initializeData();
  }, [nftAccount]);
  
  // Force refresh when modal is opened
  useEffect(() => {
    if (isOpen && nftAccount) {
      console.log('TemplateModal opened, forcing refresh of template ownership for:', nftAccount);
      checkTemplateOwnership(nftAccount, true);
    }
  }, [isOpen, nftAccount]);
  
  // Check if NFT account owns a template
  const userOwnsTemplate = (templateId: bigint) => {
    const templateIdStr = templateId.toString();
    const isOwned = !!ownedTemplates[templateIdStr];
    console.log(`userOwnsTemplate: Checking if template ${templateIdStr} is owned: ${isOwned}, ownedTemplates:`, ownedTemplates);
    return isOwned;
  };
  
  // Function to handle template selection
  const handleSelectTemplate = (templateId: bigint) => {
    // Find the template in the templates object
    let selectedTemplate: Template | undefined;
    
    // Search through all template types
    for (const type in templates) {
      const foundTemplate = templates[type].find(template => template.id === templateId);
      if (foundTemplate) {
        selectedTemplate = foundTemplate;
        break;
      }
    }
    
    // Only proceed if we found a template
    if (selectedTemplate) {
      // Get the component type name
      const componentTypeName = Object.keys(COMPONENT_TYPES).find(
        key => COMPONENT_TYPES[key as keyof typeof COMPONENT_TYPES] === selectedTemplate.componentType
      );
      
      // Create template details object
      const templateDetails: TemplateDetails = {
        ...selectedTemplate,
        componentTypeName,
        isOwned: userOwnsTemplate(templateId)
      };
      
      onSelectTemplate(templateId, templateDetails);
    } else {
      // If no template found, just pass the ID
      onSelectTemplate(templateId);
    }
    onClose();
  };
  
  // Format price from wei to ETH
  const formatPrice = (price: bigint) => {
    const priceInEth = Number(price) / 1e18;
    return priceInEth.toFixed(4);
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Modal backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
        onClick={onClose}
      >
        {/* Modal content */}
        <div 
          className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#8B5CF6] border-4 border-[#8B5CF6] w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col m-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="p-4 border-b-4 border-[#8B5CF6] flex justify-between items-center">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-[#6D28D9]">Select Component</h2>
              <p className="text-sm text-gray-500 mt-1">After selecting a template, a message will be sent in the chat to let AllNads change the template</p>
              {(loading || checkingOwnership) && (
                <div className="ml-3 animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[#8B5CF6]"></div>
              )}
            </div>
            <button 
              onClick={onClose}
              className="text-[#8B5CF6] hover:text-[#7C3AED] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Component Type Tabs - Fixed to ensure they're not covered */}
          <div className="flex border-b-4 border-[#8B5CF6] overflow-x-auto sticky top-0 bg-white z-10">
            {Object.keys(COMPONENT_TYPES).map((type) => (
              <button
                key={type}
                className={`px-2 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm ${activeTab === type 
                  ? 'bg-[#EDE9FE] text-[#8B5CF6] font-bold' 
                  : 'text-gray-500 hover:text-[#8B5CF6]'}`}
                onClick={() => setActiveTab(type)}
              >
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          
          {/* Templates Grid - Using flex layout with proper spacing, limited to 2 rows */}
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '400px' }}>
            {loading && templates[activeTab]?.length === 0 ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#8B5CF6]"></div>
              </div>
            ) : templates[activeTab]?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {templates[activeTab].map((template) => (
                  <div 
                    key={template.id.toString()} 
                    className="flex flex-col bg-white border-2 border-[#8B5CF6] rounded-xl shadow-[4px_4px_0px_0px_#8B5CF6] hover:shadow-[2px_2px_0px_0px_#8B5CF6] hover:translate-x-[2px] hover:translate-y-[2px] transition-all overflow-hidden cursor-pointer relative"
                    style={{ minWidth: '150px', maxWidth: '200px', margin: '0 auto', width: '100%' }}
                    onClick={() => handleSelectTemplate(template.id)}
                  >
                    {/* Owned badge */}
                    {userOwnsTemplate(template.id) && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full z-20">
                        Owned
                      </div>
                    )}
                    
                    {/* Template ID badge */}
                    <div className="absolute top-2 left-2 bg-[#8B5CF6] text-white text-xs px-2 py-1 rounded-full z-10 border-2 border-[#7C3AED]">
                      #{template.id.toString()}
                    </div>
                    
                    <div className="w-full aspect-square overflow-hidden bg-gray-100 relative">
                      {template.imageData ? (
                        <Image 
                          src={`data:image/png;base64,${PNG_HEADER}${template.imageData}`}
                          alt={template.name || 'Template image'}
                          className="object-cover"
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          onError={(e) => {
                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 300 300'%3E%3Crect fill='%23f0f0f0' width='300' height='300'/%3E%3Ctext fill='%23999999' font-family='Arial' font-size='14' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EImage%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-xs">No image</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-grow">
                      <h3 className="font-medium text-gray-800 truncate text-sm mb-1">{template.name}</h3>
                      <div className="flex justify-between items-center mt-auto">
                        <span className="text-xs text-gray-600">{formatPrice(template.price)} ETH</span>
                        <span className={`text-[10px] px-1 py-0.5 rounded-sm ${template.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center h-64 text-gray-500">
                No templates found for this component type
              </div>
            )}
          </div>
          
          {/* Modal Footer */}
          <div className="p-4 border-t-4 border-[#8B5CF6] flex justify-end">
            <button 
              onClick={onClose}
              className="py-3 px-6 rounded-xl font-bold text-center transition-all
                bg-[#8B5CF6] text-white border-4 border-[#7C3AED] shadow-[4px_4px_0px_0px_#5B21B6] 
                hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5B21B6]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 