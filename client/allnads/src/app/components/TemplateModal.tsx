"use client";
import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import { monadTestnet } from 'viem/chains';
import AllNadsComponentABI from '../contracts/AllNadsComponent.json';

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

// Contract addresses
const CONTRACT_ADDRESSES = {
  COMPONENT: process.env.NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_COMPONENT_CONTRACT_ADDRESS
};

interface Template {
  id: bigint;
  name: string;
  creator: string;
  maxSupply: bigint;
  currentSupply: bigint;
  price: bigint;
  imageData: string;
  isActive: boolean;
  componentType: number;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: bigint, templateDetails?: any) => void;
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
  const [allTemplateIds, setAllTemplateIds] = useState<bigint[]>([]);
  const [ownedTemplates, setOwnedTemplates] = useState<Record<string, bigint>>({});
  const [checkingOwnership, setCheckingOwnership] = useState(false);
  
  // Function to check if NFT account owns templates
  const checkTemplateOwnership = async (nftAccountAddress: string, templateIds: bigint[]) => {
    if (!nftAccountAddress || templateIds.length === 0) return;
    
    setCheckingOwnership(true);
    try {
      const contractAddress = CONTRACT_ADDRESSES.COMPONENT as string;
      
      // Create a public client
      const client = createPublicClient({
        chain: monadTestnet,
        transport: http(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC!),
      });
      
      console.log(`Checking template ownership for NFT account: ${nftAccountAddress}`);
      
      // Create batch of promises to check ownership for each template
      const ownershipPromises = templateIds.map(async (templateId) => {
        try {
          const tokenId = await client.readContract({
            address: contractAddress as `0x${string}`,
            abi: AllNadsComponentABI,
            functionName: 'getAddressTemplateToken',
            args: [nftAccountAddress as `0x${string}`, templateId],
          }) as bigint;
          
          return { templateId, tokenId };
        } catch (error) {
          // Silently handle the error as it's expected to fail for templates not owned
          return { templateId, tokenId: BigInt(0) };
        }
      });
      
      // Wait for all ownership checks to complete
      const ownershipResults = await Promise.all(ownershipPromises);
      
      // Create a map of template IDs to token IDs
      const ownedTemplatesMap = ownershipResults.reduce((acc, { templateId, tokenId }) => {
        if (tokenId && tokenId > BigInt(0)) {
          acc[templateId.toString()] = tokenId;
        }
        return acc;
      }, {} as Record<string, bigint>);
      
      setOwnedTemplates(ownedTemplatesMap);
      console.log('Owned templates by NFT account:', ownedTemplatesMap);
    } catch (error) {
      console.error('Error checking template ownership:', error);
    } finally {
      setCheckingOwnership(false);
    }
  };
  
  // Function to fetch templates by type
  const fetchTemplatesByType = async (componentType: number, typeName: string) => {
    try {
      // Use environment variable for contract address or fallback to a default
      const contractAddress = process.env.NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_COMPONENT_CONTRACT_ADDRESS!;
      
      // Create a public client
      const client = createPublicClient({
        chain: monadTestnet,
        transport: http(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC!),
      });
      
      console.log(`Fetching templates for ${typeName}...`);
      
      // Get template IDs for the specified component type
      const templateIds = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: AllNadsComponentABI,
        functionName: 'getTemplatesByType',
        args: [componentType],
      }) as bigint[];
      
      console.log(`Found ${templateIds.length} templates for ${typeName}`);
      
      // Add template IDs to the allTemplateIds array for ownership checking
      setAllTemplateIds(prev => {
        const newIds = templateIds.filter(id => !prev.some(existingId => existingId === id));
        return [...prev, ...newIds];
      });
      
      // For each template ID, get the full template details
      const templatePromises = templateIds.map(async (templateId) => {
        try {
          const templateData = await client.readContract({
            address: contractAddress as `0x${string}`,
            abi: AllNadsComponentABI,
            functionName: 'getTemplate',
            args: [templateId],
          }) as any;
          
          return {
            id: templateId,
            name: templateData.name || '',
            creator: templateData.creator || '',
            maxSupply: templateData.maxSupply || BigInt(0),
            currentSupply: templateData.currentSupply || BigInt(0),
            price: templateData.price || BigInt(0),
            imageData: templateData.imageData || '',
            isActive: templateData.isActive || false,
            componentType: templateData.componentType || 0
          } as Template;
        } catch (error) {
          console.error(`Error fetching template ${templateId}:`, error);
          return null;
        }
      });
      
      const fetchedTemplates = (await Promise.all(templatePromises)).filter(Boolean) as Template[];
      
      console.log(`Successfully fetched ${fetchedTemplates.length} templates for ${typeName}`);
      
      // Update state with the fetched templates
      setTemplates(prev => ({
        ...prev,
        [typeName]: fetchedTemplates
      }));
      
    } catch (error) {
      console.error(`Error fetching templates for component type ${componentType}:`, error);
    }
  };
  
  // Function to get the connected user's address
  const getUserAddress = async () => {
    try {
      // Check if window.ethereum is available
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          console.log("Got user wallet address:", accounts[0]);
          return accounts[0];
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting user address:', error);
      return null;
    }
  };
  
  // Function to load all templates
  const loadAllTemplates = async () => {
    if (templatesLoaded && Object.keys(templates).length > 0) {
      console.log("Using cached templates");
      return;
    }
    
    setLoading(true);
    try {
      console.log("Starting background loading of all templates...");
      const typeNames = Object.keys(COMPONENT_TYPES);
      const typeValues = Object.values(COMPONENT_TYPES);
      
      // Create an array of promises for all template types
      const fetchPromises = typeNames.map((typeName, index) => {
        return fetchTemplatesByType(typeValues[index], typeName);
      });
      
      // Execute all promises in parallel
      await Promise.all(fetchPromises);
      
      console.log("All templates loaded successfully in the background");
      setTemplatesLoaded(true);
    } catch (error) {
      console.error("Error loading templates in the background:", error);
      // We don't set templatesLoaded to false here so it will try again next time if needed
    } finally {
      setLoading(false);
    }
  };
  
  // Load templates when component mounts
  useEffect(() => {
    // Only load templates if nftAccount exists
    if (nftAccount) {
      loadAllTemplates();
    } else {
      console.log("Waiting for nftAccount before loading templates");
    }
    
    // If nftAccount is not provided, try to get the user's address
    if (!nftAccount) {
      console.log("No nftAccount provided, attempting to get user address");
      getUserAddress().then(address => {
        if (address) {
          console.log("Using user wallet address as fallback:", address);
          // Note: We're not setting any state here, just logging for debugging
        }
      });
    } else {
      console.log("nftAccount provided:", nftAccount);
    }
  }, [nftAccount]);
  
  // Check template ownership when nftAccount or template IDs change
  useEffect(() => {
    console.log("TemplateModal useEffect triggered with:", { 
      nftAccount, 
      templateIdsCount: allTemplateIds.length 
    });
    
    if (nftAccount && allTemplateIds.length > 0) {
      console.log("Conditions met, calling checkTemplateOwnership");
      checkTemplateOwnership(nftAccount, allTemplateIds);
    } else {
      console.log("Conditions not met for checking ownership:", { 
        hasNftAccount: !!nftAccount, 
        templateIdsCount: allTemplateIds.length 
      });
    }
  }, [nftAccount, allTemplateIds]);
  
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
    
    // Get the component type name
    const componentTypeName = Object.keys(COMPONENT_TYPES).find(
      key => COMPONENT_TYPES[key as keyof typeof COMPONENT_TYPES] === selectedTemplate?.componentType
    );
    
    // Create template details object
    const templateDetails = {
      ...selectedTemplate,
      componentTypeName,
      isOwned: userOwnsTemplate(templateId)
    };
    
    onSelectTemplate(templateId, templateDetails);
    onClose();
  };
  
  // Format price from wei to ETH
  const formatPrice = (price: bigint) => {
    const priceInEth = Number(price) / 1e18;
    return priceInEth.toFixed(4);
  };
  
  // Format address for display
  const formatAddress = (address: string) => {
    if (!address || address.length < 42) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Check if NFT account owns a template
  const userOwnsTemplate = (templateId: bigint) => {
    return !!ownedTemplates[templateId.toString()];
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
          className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col m-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="p-3 border-b border-gray-200 flex justify-between items-center">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-gray-800">Select Component</h2>
              <p className="text-sm text-gray-500 mt-1">选择模板后将在聊天中发送消息，邀请对方也换上相同的模板</p>
              {(loading || checkingOwnership) && (
                <div className="ml-3 animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
              )}
            </div>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Component Type Tabs - Fixed to ensure they're not covered */}
          <div className="flex border-b border-gray-200 overflow-x-auto sticky top-0 bg-white z-10">
            {Object.keys(COMPONENT_TYPES).map((type) => (
              <button
                key={type}
                className={`px-4 py-3 font-medium text-sm ${activeTab === type 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab(type)}
              >
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          
          {/* Templates Grid - Using flex layout with proper spacing */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading && templates[activeTab]?.length === 0 ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : templates[activeTab]?.length > 0 ? (
              <div className="flex flex-wrap justify-start">
                {templates[activeTab].map((template) => (
                  <div 
                    key={template.id.toString()} 
                    className="m-2 flex flex-col bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer relative"
                    style={{ width: '180px' }}
                    onClick={() => handleSelectTemplate(template.id)}
                  >
                    {/* Owned badge */}
                    {userOwnsTemplate(template.id) && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full z-10">
                        已拥有
                      </div>
                    )}
                    
                    {/* Template ID badge */}
                    <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full z-10">
                      #{template.id.toString()}
                    </div>
                    
                    <div className="w-[180px] h-[180px] overflow-hidden bg-gray-100">
                      {template.imageData ? (
                        <img 
                          src={`data:image/png;base64,${PNG_HEADER}${template.imageData}`}
                          alt={template.name}
                          className="w-full h-full object-cover"
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
          <div className="p-3 border-t border-gray-200 flex justify-end">
            <button 
              onClick={onClose}
              className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 