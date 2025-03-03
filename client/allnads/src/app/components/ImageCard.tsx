"use client";
import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import { hardhat, monadTestnet } from 'viem/chains';
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

interface ImageCardProps {
  imageUrl?: string;
  alt?: string;
  title?: string;
  caption?: string;
  onChangeComponent?: (templateId: bigint) => void;
}

export default function ImageCard({ 
  imageUrl = "/image-placeholder.jpg", 
  alt = "Featured Image",
  title,
  onChangeComponent
}: ImageCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templates, setTemplates] = useState<{[key: string]: Template[]}>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("BACKGROUND");
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  
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
  
  // Function to load all templates
  const loadAllTemplates = async () => {
    if (templatesLoaded && Object.keys(templates).length > 0) {
      console.log("Using cached templates");
      return;
    }
    
    setLoading(true);
    try {
      const typeNames = Object.keys(COMPONENT_TYPES);
      const typeValues = Object.values(COMPONENT_TYPES);
      
      for (let i = 0; i < typeNames.length; i++) {
        const typeName = typeNames[i];
        const typeValue = typeValues[i];
        await fetchTemplatesByType(typeValue, typeName);
      }
      setTemplatesLoaded(true);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Preload templates when component mounts
  useEffect(() => {
    // We can optionally preload templates when component mounts
    // Uncomment the next line to enable preloading
    // loadAllTemplates();
  }, []);
  
  // Function to open modal and load templates if needed
  const handleOpenModal = () => {
    setIsModalOpen(true);
    if (!templatesLoaded || Object.keys(templates).length === 0) {
      loadAllTemplates();
    }
  };
  
  // Function to handle template selection
  const handleSelectTemplate = (templateId: bigint) => {
    if (onChangeComponent) {
      onChangeComponent(templateId);
    }
    setIsModalOpen(false);
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
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
      <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-100">
        <img 
          src={imageUrl} 
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            // 如果图片加载失败，显示一个占位符
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
        Change Component
      </button>
      
      {/* Component Selection Modal */}
      {isModalOpen && (
        <>
          {/* Modal backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
            onClick={() => setIsModalOpen(false)}
          >
            {/* Modal content */}
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col m-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Select Component</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
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
                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : templates[activeTab]?.length > 0 ? (
                  <div className="flex flex-wrap justify-start">
                    {templates[activeTab].map((template) => (
                      <div 
                        key={template.id.toString()} 
                        className="m-2 flex flex-col bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
                        style={{ width: '120px' }}
                        onClick={() => handleSelectTemplate(template.id)}
                      >
                        <div className="w-[120px] h-[120px] overflow-hidden bg-gray-100">
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
                        <div className="p-2 flex flex-col flex-grow">
                          <h3 className="font-medium text-gray-800 truncate text-xs mb-1">{template.name}</h3>
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
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 