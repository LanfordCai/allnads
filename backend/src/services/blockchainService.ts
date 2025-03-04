import { createPublicClient, createWalletClient, http, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { serializeBigInt } from '../utils/serialization';

dotenv.config();

// Simplified ABIs with only the functions we need
const AllNadsABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Template-related ABIs
const AllNadsComponentABI = [
  {
    "inputs": [
      {
        "internalType": "enum AllNadsComponent.ComponentType",
        "name": "_componentType",
        "type": "uint8"
      }
    ],
    "name": "getTemplatesByType",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_templateId",
        "type": "uint256"
      }
    ],
    "name": "getTemplate",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "creator",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "maxSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "currentSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "price",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "imageData",
            "type": "string"
          },
          {
            "internalType": "bool",
            "name": "isActive",
            "type": "bool"
          },
          {
            "internalType": "enum AllNadsComponent.ComponentType",
            "name": "componentType",
            "type": "uint8"
          }
        ],
        "internalType": "struct AllNadsComponent.Template",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
];

const AllNadsAirdropperABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "backgroundTemplateId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "hairstyleTemplateId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "eyesTemplateId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "mouthTemplateId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "accessoryTemplateId",
        "type": "uint256"
      }
    ],
    "name": "mintTo",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

// Network configurations
const NETWORKS = {
  monadTestnet: {
    chain: {
      id: 10143,
      name: 'Monad Testnet',
      network: 'monadTestnet',
      nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
      rpcUrls: {
        default: { http: [process.env.MONAD_TESTNET_RPC as string] }
      }
    },
    allnadsAddress: process.env.MONAD_TESTNET_ALLNADS_COMPONENT_CONTRACT_ADDRESS as Address,
    airdropperAddress: process.env.MONAD_TESTNET_AIRDROPPER_CONTRACT_ADDRESS as Address,
    privateKey: process.env.MONAD_AIRDROPPER_PRIVATE_KEY
  }
};

// Component types mapping
export const COMPONENT_TYPES = {
  BACKGROUND: 0,
  HAIRSTYLE: 1,
  EYES: 2,
  MOUTH: 3,
  ACCESSORY: 4
};

// Define Template interface
export interface Template {
  id: bigint;
  name: string;
  componentType: number;
  price: bigint;
  isActive: boolean;
  creator: Address;
  imageData: string;
}

// Class to handle blockchain interactions
export class BlockchainService {
  private publicClient;
  private walletClient;
  private account;
  private allnadsAddress: Address;
  private airdropperAddress: Address;
  
  // Template cache
  private templateCache: {
    templates: { [key: string]: Template[] };
    lastUpdated: number;
  } = {
    templates: {},
    lastUpdated: 0
  };

  // Path for template cache file
  private templateCacheFilePath: string;

  constructor(network = 'monadTestnet') {
    // Validate network selection
    if (!NETWORKS[network as keyof typeof NETWORKS]) {
      throw new Error(`Unsupported network: ${network}`);
    }
    
    const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
    
    // Check required environment variables
    if (!networkConfig.privateKey) {
      throw new Error(`Private key not found for ${network}. Check your environment variables.`);
    }

    // Create account from private key
    this.account = privateKeyToAccount(`0x${networkConfig.privateKey}`);
    
    // Create public client
    this.publicClient = createPublicClient({
      chain: networkConfig.chain,
      transport: http(),
    });
    
    // Create wallet client
    this.walletClient = createWalletClient({
      chain: networkConfig.chain,
      transport: http(),
      account: this.account,
    });
    
    this.allnadsAddress = networkConfig.allnadsAddress;
    this.airdropperAddress = networkConfig.airdropperAddress;

    // Set template cache file path using process.cwd() which is the current working directory
    this.templateCacheFilePath = path.join(process.cwd(), 'data/templates.json');
    Logger.debug('BlockchainService', `Template cache file path: ${this.templateCacheFilePath}`);
    
    // Ensure data directory exists
    const dataDir = path.dirname(this.templateCacheFilePath);
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        Logger.info('BlockchainService', `Created data directory at ${dataDir}`);
      } catch (error) {
        Logger.error('BlockchainService', `Failed to create data directory at ${dataDir}:`, error);
      }
    } else {
      Logger.debug('BlockchainService', `Data directory already exists at ${dataDir}`);
    }
  }
  
  /**
   * Initialize the template cache
   */
  async initializeTemplateCache(): Promise<void> {
    try {
      Logger.info('BlockchainService', 'Initializing template cache...');
      
      // Check if cache file exists and is not too old
      if (await this.loadTemplatesFromFile()) {
        Logger.info('BlockchainService', 'Template cache loaded from file successfully');
        return;
      }
      
      // If file doesn't exist or is too old, load from blockchain
      await this.loadAllTemplates();
      
      // Save templates to file
      await this.saveTemplatesToFile();
      
      Logger.info('BlockchainService', 'Template cache initialized successfully');
    } catch (error) {
      Logger.error('BlockchainService', 'Failed to initialize template cache', error);
      // We'll continue without the cache and try again later
    }
  }

  /**
   * Load templates from JSON file
   * @returns boolean indicating if templates were successfully loaded from file
   */
  private async loadTemplatesFromFile(): Promise<boolean> {
    try {
      // Check if file exists
      if (!fs.existsSync(this.templateCacheFilePath)) {
        Logger.info('BlockchainService', 'Template cache file does not exist');
        return false;
      }

      // Read file
      const fileData = fs.readFileSync(this.templateCacheFilePath, 'utf8');
      
      // Check if file is empty
      if (!fileData || fileData.trim() === '') {
        Logger.warn('BlockchainService', 'Template cache file is empty');
        return false;
      }
      
      let cacheData;
      try {
        cacheData = JSON.parse(fileData);
      } catch (parseError) {
        Logger.warn('BlockchainService', 'Template cache file contains invalid JSON, will be regenerated', parseError);
        return false;
      }
      
      // Check if data structure is valid
      if (!cacheData || !cacheData.templates || !cacheData.lastUpdated) {
        Logger.warn('BlockchainService', 'Template cache file has invalid structure, will be regenerated');
        return false;
      }
      
      // Convert string IDs back to bigint
      const templates = cacheData.templates;
      for (const key in templates) {
        try {
          templates[key] = templates[key].map((template: any) => ({
            ...template,
            id: BigInt(template.id),
            price: BigInt(template.price)
          }));
        } catch (conversionError) {
          Logger.warn('BlockchainService', `Error converting template data for ${key}, will be regenerated`, conversionError);
          return false;
        }
      }
      
      // Update cache
      this.templateCache.templates = templates;
      this.templateCache.lastUpdated = cacheData.lastUpdated;
      
      Logger.info('BlockchainService', 'Templates loaded from file successfully');
      return true;
    } catch (error) {
      Logger.error('BlockchainService', 'Error loading templates from file:', error);
      // If there's any error, we'll regenerate the cache
      return false;
    }
  }

  /**
   * Save templates to JSON file
   */
  private async saveTemplatesToFile(): Promise<void> {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.templateCacheFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        Logger.info('BlockchainService', `Created data directory at ${dir} for saving templates`);
      }
      
      // Serialize templates with BigInt values converted to strings
      const templates = serializeBigInt(this.templateCache.templates);
      
      // Prepare data to save
      const dataToSave = {
        templates,
        lastUpdated: this.templateCache.lastUpdated
      };
      
      // Write to file
      fs.writeFileSync(this.templateCacheFilePath, JSON.stringify(dataToSave, null, 2), 'utf8');
      
      Logger.info('BlockchainService', `Templates saved to file successfully at ${this.templateCacheFilePath}`);
    } catch (error) {
      Logger.error('BlockchainService', 'Error saving templates to file:', error);
      throw error;
    }
  }
  
  /**
   * Load all templates into the cache
   */
  private async loadAllTemplates(): Promise<void> {
    try {
      Logger.debug('BlockchainService', 'Loading all templates into cache...');
      
      const componentTypes = Object.values(COMPONENT_TYPES);
      const newTemplates: { [key: string]: Template[] } = {};
      
      // For each component type, get all templates
      for (const componentType of componentTypes) {
        const typeKey = Object.keys(COMPONENT_TYPES).find(
          key => COMPONENT_TYPES[key as keyof typeof COMPONENT_TYPES] === componentType
        ) || componentType.toString();
        
        // Get template IDs directly from blockchain
        const templateIds = await this.publicClient.readContract({
          address: this.allnadsAddress,
          abi: AllNadsComponentABI,
          functionName: 'getTemplatesByType',
          args: [componentType],
        }) as bigint[];
        
        // Get full template details for each ID
        const templates: Template[] = [];
        for (const templateId of templateIds) {
          try {
            // Get template details directly from blockchain
            const templateData = await this.publicClient.readContract({
              address: this.allnadsAddress,
              abi: AllNadsComponentABI,
              functionName: 'getTemplate',
              args: [templateId],
            }) as any;
            
            // Create template object with ID included
            const template: Template = {
              id: templateId,
              name: templateData.name,
              componentType: Number(templateData.componentType),
              price: templateData.price,
              isActive: templateData.isActive,
              creator: templateData.creator,
              imageData: templateData.imageData
            };
            
            templates.push(template);
          } catch (error) {
            Logger.error('BlockchainService', `Error fetching template ${templateId}:`, error);
            // Continue with other templates
          }
        }
        
        newTemplates[typeKey] = templates;
      }
      
      // Update the cache
      this.templateCache.templates = newTemplates;
      this.templateCache.lastUpdated = Date.now();
      
      Logger.info('BlockchainService', 'Templates loaded successfully into cache');
    } catch (error) {
      Logger.error('BlockchainService', 'Error loading templates into cache:', error);
      throw error;
    }
  }
  
  /**
   * Check if an address owns any AllNads NFTs
   * @param address The address to check
   * @returns A boolean indicating if the address owns any NFTs
   */
  async hasAllNadsNFT(address: Address): Promise<boolean> {
    try {
      const balance = await this.publicClient.readContract({
        address: this.allnadsAddress,
        abi: AllNadsABI,
        functionName: 'balanceOf',
        args: [address],
      });
      
      return Number(balance) > 0;
    } catch (error) {
      Logger.error('BlockchainService', `Error checking if address ${address} has AllNads NFT:`, error);
      throw error;
    }
  }
  
  /**
   * Airdrop an AllNads NFT to an address
   * @param to The address to receive the NFT
   * @param name The name for the NFT
   * @param backgroundId The background component ID
   * @param hairstyleId The hairstyle component ID
   * @param eyesId The eyes component ID
   * @param mouthId The mouth component ID
   * @param accessoryId The accessory component ID
   * @returns The transaction hash
   */
  async airdropNFT(
    to: Address,
    name: string,
    backgroundId: bigint,
    hairstyleId: bigint,
    eyesId: bigint,
    mouthId: bigint,
    accessoryId: bigint
  ): Promise<string> {
    try {
      const hash = await this.walletClient.writeContract({
        address: this.airdropperAddress,
        abi: AllNadsAirdropperABI,
        functionName: 'mintTo',
        args: [to, name, backgroundId, hairstyleId, eyesId, mouthId, accessoryId],
      });
      
      // Wait for transaction confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      Logger.info('BlockchainService', `Airdrop transaction confirmed in block ${receipt.blockNumber}`);
      
      return hash;
    } catch (error) {
      Logger.error('BlockchainService', `Error airdropping NFT to ${to}:`, error);
      throw error;
    }
  }
  
  /**
   * Select default component IDs for the airdrop
   * This uses hardcoded IDs for simplicity, but could be enhanced to fetch valid templates
   */
  getDefaultTemplateIds(): { 
    backgroundTemplateId: bigint, 
    hairstyleTemplateId: bigint, 
    eyesTemplateId: bigint, 
    mouthTemplateId: bigint, 
    accessoryTemplateId: bigint 
  } {
    // Using default IDs - in production, you'd want to fetch these from the contract
    return {
      backgroundTemplateId: BigInt(9),
      hairstyleTemplateId: BigInt(24),
      eyesTemplateId: BigInt(14),
      mouthTemplateId: BigInt(31),
      accessoryTemplateId: BigInt(1)
    };
  }
  
  /**
   * Get all templates for all component types
   * @returns Object with templates grouped by component type
   */
  async getAllTemplates(): Promise<{ [key: string]: Template[] }> {
    // Return the cached templates
    if (Object.keys(this.templateCache.templates).length > 0) {
      Logger.debug('BlockchainService', 'Using cached templates');
      return this.templateCache.templates;
    }
    
    // If cache is empty, load templates
    Logger.debug('BlockchainService', 'Cache empty, loading templates');
    await this.loadAllTemplates();
    
    // Save templates to file after loading
    await this.saveTemplatesToFile();
    
    return this.templateCache.templates;
  }

  /**
   * Manually refresh templates from blockchain
   * This should be called explicitly when templates need to be updated
   * @returns Updated templates
   */
  async refreshTemplates(): Promise<{ [key: string]: Template[] }> {
    try {
      Logger.info('BlockchainService', 'Manually refreshing templates from blockchain...');
      
      // Load templates from blockchain
      await this.loadAllTemplates();
      
      // Save to file
      await this.saveTemplatesToFile();
      
      Logger.info('BlockchainService', 'Templates refreshed successfully');
      return this.templateCache.templates;
    } catch (error) {
      Logger.error('BlockchainService', 'Error refreshing templates:', error);
      throw error;
    }
  }

  /**
   * Get the path to the template cache file
   * @returns The absolute path to the template cache file
   */
  getTemplateCacheFilePath(): string {
    return this.templateCacheFilePath;
  }
}

// Export a singleton instance
// Use blockchainService.refreshTemplates() to manually refresh templates from blockchain when needed
export const blockchainService = new BlockchainService(); 