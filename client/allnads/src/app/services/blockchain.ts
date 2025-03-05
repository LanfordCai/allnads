import { createPublicClient, http, PublicClient, Address, formatEther } from 'viem';
import { monadTestnet, contractAddresses } from '../config/chains';
import AllNadsComponentABI from '../contracts/AllNadsComponent.json';
import AllNadsABI from '../contracts/AllNads.json';
import AllNadsComponentQueryABI from '../contracts/AllNadsComponentQuery.json';
import { RateLimiter, withRateLimitAndRetry } from '../utils/rateLimit';

// Define Template interface
export interface Template {
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

// Define AvatarData interface
export interface AvatarData {
  name: string;
  backgroundId: bigint;
  hairstyleId: bigint;
  eyesId: bigint;
  mouthId: bigint;
  accessoryId: bigint;
}

class BlockchainService {
  private static instance: BlockchainService;
  private publicClient: PublicClient;
  private rateLimiter: RateLimiter;
  private callCounter: number = 0;

  private constructor() {
    this.publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC!),
    });
    
    // Initialize rate limiter with 10 requests per second
    this.rateLimiter = new RateLimiter(10);
  }

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  public getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /**
   * Get current rate limiter status
   */
  public getRateLimiterStatus(): { active: number; queued: number; availableTokens: number } {
    return this.rateLimiter.getStatus();
  }

  /**
   * Wraps a blockchain call with rate limiting and retry logic
   * @param fn Function to wrap
   * @returns Rate-limited and retry-enabled function
   */
  private wrapBlockchainCall<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, methodName: string): T {
    console.log('wrapBlockchainCall', methodName);
    const wrappedFn = async (...args: unknown[]): Promise<unknown> => {
      try {
        const result = await fn(...args);
        return result;
      } catch (err) {
        throw err;
      }
    };
    
    return withRateLimitAndRetry(wrappedFn as T, this.rateLimiter, 3);
  }

  public async getBalance(address: Address): Promise<string> {
    const getBalanceWithRetry = this.wrapBlockchainCall(async () => {
      const balance = await this.publicClient.getBalance({ address });
      return formatEther(balance);
    }, 'getBalance');
    
    return await getBalanceWithRetry();
  }

  public getContractAddress(contractName: keyof typeof contractAddresses[typeof monadTestnet.id]): Address {
    return contractAddresses[monadTestnet.id][contractName];
  }

  /**
   * Get the connected user's Ethereum address
   */
  public async getUserAddress(): Promise<string | null> {
    try {
      // Check if window.ethereum is available
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          return accounts[0];
        }
      }
      return null;
    } catch (error) {
      console.debug('Error getting user address', error);
      return null;
    }
  }

  /**
   * Get template IDs for a specific component type
   */
  public async getTemplatesByType(componentType: number): Promise<bigint[]> {
    const contractAddress = this.getContractAddress('allNadsComponent');
    
    const getTemplatesWithRetry = this.wrapBlockchainCall(async () => {
      return await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsComponentABI,
        functionName: 'getTemplatesByType',
        args: [componentType],
      }) as bigint[];
    }, 'getTemplatesByType');
    
    const templateIds = await getTemplatesWithRetry();
    
    return templateIds;
  }

  /**
   * Get template details by ID
   */
  public async getTemplateById(templateId: bigint): Promise<Template> {
    const contractAddress = this.getContractAddress('allNadsComponent');
    
    try {
      const getTemplateWithRetry = this.wrapBlockchainCall(async () => {
        return await this.publicClient.readContract({
          address: contractAddress,
          abi: AllNadsComponentABI,
          functionName: 'getTemplate',
          args: [templateId],
        }) as {
          name: string;
          creator: string;
          maxSupply: bigint;
          currentSupply: bigint;
          price: bigint;
          imageData: string;
          isActive: boolean;
          componentType: number;
        };
      }, `getTemplateById(${templateId})`);
      
      const templateData = await getTemplateWithRetry();
      
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
    } catch (err) {
      throw err;
    }
  }

  /**
   * Get all owned templates for an address
   */
  public async getAllOwnedTemplates(address: string): Promise<{
    templateIds: bigint[];
    templateTypes: number[];
    tokenIds: bigint[];
  }> {
    const queryContractAddress = this.getContractAddress('allNadsComponentQuery');
    
    try {
      const getAllOwnedTemplatesWithRetry = this.wrapBlockchainCall(async () => {
        return await this.publicClient.readContract({
          address: queryContractAddress,
          abi: AllNadsComponentQueryABI,
          functionName: 'getAllOwnedTemplates',
          args: [address as `0x${string}`],
        }) as [bigint[], number[], bigint[]];
      }, `getAllOwnedTemplates(${address})`);
      
      const [ownedTemplateIds, templateTypes, tokenIds] = await getAllOwnedTemplatesWithRetry();
      
      return {
        templateIds: ownedTemplateIds,
        templateTypes: templateTypes,
        tokenIds: tokenIds
      };
    } catch (error) {
      console.debug('Error getting all owned templates', error);
      return {
        templateIds: [],
        templateTypes: [],
        tokenIds: []
      };
    }
  }

  /**
   * Fetch token image and name from NFT contract
   */
  public async fetchTokenImageAndName(tokenId: string): Promise<{ image: string | null; name: string | null }> {
    try {
      const contractAddress = this.getContractAddress('allNads');
      
      // Get token URI
      const getTokenURIWithRetry = this.wrapBlockchainCall(async () => {
        return await this.publicClient.readContract({
          address: contractAddress,
          abi: AllNadsABI,
          functionName: 'tokenURI',
          args: [BigInt(tokenId)],
        }) as string;
      }, `fetchTokenURI(${tokenId})`);
      
      const tokenURI = await getTokenURIWithRetry();
      
      // Parse tokenURI (it's likely base64 encoded JSON)
      const jsonData = tokenURI.replace('data:application/json,', '');
      
      try {
        const json = JSON.parse(jsonData);
        
        return {
          name: json.name || null,
          image: json.image || null
        };
      } catch (parseError) {
        console.debug('Error parsing tokenURI', parseError);
        return { name: null, image: null };
      }
    } catch (error) {
      console.debug('Error fetching token image and name', error);
      return { name: null, image: null };
    }
  }

  /**
   * Get the component contract address from the AllNads contract
   */
  public async getComponentContractAddress(): Promise<Address> {
    const contractAddress = this.getContractAddress('allNads');
    
    const getComponentAddressWithRetry = this.wrapBlockchainCall(async () => {
      return await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsABI,
        functionName: 'componentContract',
      }) as Address;
    }, 'getComponentContractAddress');
    
    return await getComponentAddressWithRetry();
  }

  /**
   * Get avatar data for a token
   */
  public async getAvatarData(tokenId: string): Promise<AvatarData> {
    const contractAddress = this.getContractAddress('allNads');
    
    const getAvatarDataWithRetry = this.wrapBlockchainCall(async () => {
      const result = await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsABI,
        functionName: 'getAvatar',
        args: [BigInt(tokenId)],
      });
      
      // Convert the result to AvatarData
      return result as AvatarData;
    }, `getAvatarData(${tokenId})`);
    
    return await getAvatarDataWithRetry() as AvatarData;
  }

  /**
   * Get template ID for a component token
   */
  public async getTokenTemplate(componentId: bigint): Promise<bigint> {
    const contractAddress = this.getContractAddress('allNadsComponent');
    
    const getTokenTemplateWithRetry = this.wrapBlockchainCall(async () => {
      return await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsComponentABI,
        functionName: 'getTokenTemplate',
        args: [componentId],
      }) as bigint;
    }, `getTokenTemplate(${componentId})`);
    
    return await getTokenTemplateWithRetry();
  }

  /**
   * Get token URI for an NFT
   */
  public async getTokenURI(tokenId: string): Promise<string> {
    const contractAddress = this.getContractAddress('allNads');
    
    const getTokenURIWithRetry = this.wrapBlockchainCall(async () => {
      return await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      }) as string;
    }, `getTokenURI(${tokenId})`);
    
    return await getTokenURIWithRetry();
  }

  /**
   * Get NFT balance for an address
   */
  public async getNFTBalance(address: string): Promise<bigint> {
    const contractAddress = this.getContractAddress('allNads');
    
    const getNFTBalanceWithRetry = this.wrapBlockchainCall(async () => {
      return await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }) as bigint;
    }, `getNFTBalance(${address})`);
    
    return await getNFTBalanceWithRetry();
  }

  /**
   * Get token ID owned by an address at a specific index
   */
  public async getTokenOfOwnerByIndex(address: string, index: number): Promise<bigint> {
    const contractAddress = this.getContractAddress('allNads');
    
    const getTokenByIndexWithRetry = this.wrapBlockchainCall(async () => {
      return await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [address as `0x${string}`, index],
      }) as bigint;
    }, `getTokenOfOwnerByIndex(${address}, ${index})`);
    
    return await getTokenByIndexWithRetry();
  }

  /**
   * Get account address for a token
   */
  public async getAccountForToken(tokenId: bigint): Promise<string> {
    const contractAddress = this.getContractAddress('allNads');
    
    const getAccountForTokenWithRetry = this.wrapBlockchainCall(async () => {
      return await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsABI,
        functionName: 'accountForToken',
        args: [tokenId],
      }) as string;
    }, `getAccountForToken(${tokenId})`);
    
    return await getAccountForTokenWithRetry();
  }

  /**
   * Fetch all templates from the API
   */
  public async fetchAllTemplatesFromAPI(): Promise<Record<string, Template[]>> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/nft/templates`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      // Check if the response has the expected structure
      if (!responseData.success) {
        throw new Error(`API returned error: ${responseData.message || 'Unknown error'}`);
      }
      
      // Extract templates from the response
      const templates = responseData.data?.templates || {};
      
      // Convert template IDs from string to bigint and ensure other properties are correctly typed
      const processedTemplates: Record<string, Template[]> = {};
      
      Object.entries(templates).forEach(([typeName, typeTemplates]) => {
        if (Array.isArray(typeTemplates)) {
          processedTemplates[typeName] = typeTemplates.map(template => ({
            id: BigInt(template.id),
            name: template.name,
            creator: template.creator,
            maxSupply: template.maxSupply ? BigInt(template.maxSupply) : BigInt(0),
            currentSupply: template.currentSupply ? BigInt(template.currentSupply) : BigInt(0),
            price: BigInt(template.price || 0),
            imageData: template.imageData,
            isActive: template.isActive,
            componentType: template.componentType
          }));
        }
      });
      
      return processedTemplates;
    } catch (error) {
      throw error;
    }
  }
}

export const blockchainService = BlockchainService.getInstance(); 