import { createPublicClient, http, PublicClient, Address, formatEther } from 'viem';
import { monadTestnet, contractAddresses } from '../config/chains';
import AllNadsComponentABI from '../contracts/AllNadsComponent.json';
import AllNadsABI from '../contracts/AllNads.json';

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

class BlockchainService {
  private static instance: BlockchainService;
  private publicClient: PublicClient;

  private constructor() {
    this.publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC!),
    });
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

  public async getBalance(address: Address): Promise<string> {
    const balance = await this.publicClient.getBalance({ address });
    return formatEther(balance);
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
          console.log("Got user wallet address:", accounts[0]);
          return accounts[0];
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting user address:', error);
      return null;
    }
  }

  /**
   * Get template IDs for a specific component type
   */
  public async getTemplatesByType(componentType: number): Promise<bigint[]> {
    const contractAddress = this.getContractAddress('allNadsComponent');
    
    console.log(`Fetching templates for component type ${componentType}...`);
    
    const templateIds = await this.publicClient.readContract({
      address: contractAddress,
      abi: AllNadsComponentABI,
      functionName: 'getTemplatesByType',
      args: [componentType],
    }) as bigint[];
    
    console.log(`Found ${templateIds.length} templates for component type ${componentType}`);
    
    return templateIds;
  }

  /**
   * Get template details by ID
   */
  public async getTemplateById(templateId: bigint): Promise<Template> {
    const contractAddress = this.getContractAddress('allNadsComponent');
    
    try {
      const templateData = await this.publicClient.readContract({
        address: contractAddress,
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
      throw error;
    }
  }

  /**
   * Check if an NFT account owns a specific template
   */
  public async checkTemplateOwnership(nftAccountAddress: string, templateId: bigint): Promise<bigint> {
    const contractAddress = this.getContractAddress('allNadsComponent');
    
    try {
      const tokenId = await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsComponentABI,
        functionName: 'getAddressTemplateToken',
        args: [nftAccountAddress as `0x${string}`, templateId],
      }) as bigint;
      
      return tokenId;
    } catch (error) {
      // Silently handle the error as it's expected to fail for templates not owned
      return BigInt(0);
    }
  }

  /**
   * Check ownership for multiple templates at once
   */
  public async checkMultipleTemplateOwnership(
    nftAccountAddress: string, 
    templateIds: bigint[]
  ): Promise<Record<string, bigint>> {
    if (!nftAccountAddress || templateIds.length === 0) return {};
    
    console.log(`Checking template ownership for NFT account: ${nftAccountAddress}`);
    
    // Create batch of promises to check ownership for each template
    const ownershipPromises = templateIds.map(templateId => 
      this.checkTemplateOwnership(nftAccountAddress, templateId)
        .then(tokenId => ({ templateId, tokenId }))
    );
    
    // Wait for all ownership checks to complete
    const ownershipResults = await Promise.all(ownershipPromises);
    
    // Create a map of template IDs to token IDs
    const ownedTemplatesMap = ownershipResults.reduce((acc, { templateId, tokenId }) => {
      if (tokenId && tokenId > BigInt(0)) {
        acc[templateId.toString()] = tokenId;
      }
      return acc;
    }, {} as Record<string, bigint>);
    
    console.log('Owned templates by NFT account:', ownedTemplatesMap);
    return ownedTemplatesMap;
  }

  /**
   * Fetch token image and name from NFT contract
   */
  public async fetchTokenImageAndName(tokenId: string): Promise<{ image: string | null; name: string | null }> {
    try {
      const contractAddress = this.getContractAddress('allNads');
      
      // Get token URI
      const tokenURI = await this.publicClient.readContract({
        address: contractAddress,
        abi: AllNadsABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      }) as string;
      
      // Parse tokenURI (it's likely base64 encoded JSON)
      const jsonData = tokenURI.replace('data:application/json,', '');
      
      try {
        const json = JSON.parse(jsonData);
        
        return {
          name: json.name || null,
          image: json.image || null
        };
      } catch (parseError) {
        console.error("Error parsing NFT metadata:", parseError);
        return { name: null, image: null };
      }
    } catch (error) {
      console.error('Error fetching token image:', error);
      return { name: null, image: null };
    }
  }

  /**
   * Get the component contract address from the AllNads contract
   */
  public async getComponentContractAddress(): Promise<Address> {
    const contractAddress = this.getContractAddress('allNads');
    
    return await this.publicClient.readContract({
      address: contractAddress,
      abi: AllNadsABI,
      functionName: 'componentContract',
    }) as Address;
  }

  /**
   * Get avatar data for a token
   */
  public async getAvatarData(tokenId: string): Promise<any> {
    const contractAddress = this.getContractAddress('allNads');
    
    return await this.publicClient.readContract({
      address: contractAddress,
      abi: AllNadsABI,
      functionName: 'getAvatar',
      args: [BigInt(tokenId)],
    });
  }

  /**
   * Get template ID for a component token
   */
  public async getTokenTemplate(componentId: bigint): Promise<bigint> {
    const contractAddress = this.getContractAddress('allNadsComponent');
    
    return await this.publicClient.readContract({
      address: contractAddress,
      abi: AllNadsComponentABI,
      functionName: 'getTokenTemplate',
      args: [componentId],
    }) as bigint;
  }

  /**
   * Get token URI for an NFT
   */
  public async getTokenURI(tokenId: string): Promise<string> {
    const contractAddress = this.getContractAddress('allNads');
    
    return await this.publicClient.readContract({
      address: contractAddress,
      abi: AllNadsABI,
      functionName: 'tokenURI',
      args: [BigInt(tokenId)],
    }) as string;
  }

  /**
   * Get NFT balance for an address
   */
  public async getNFTBalance(address: string): Promise<bigint> {
    const contractAddress = this.getContractAddress('allNads');
    
    return await this.publicClient.readContract({
      address: contractAddress,
      abi: AllNadsABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    }) as bigint;
  }

  /**
   * Get token ID owned by an address at a specific index
   */
  public async getTokenOfOwnerByIndex(address: string, index: number): Promise<bigint> {
    const contractAddress = this.getContractAddress('allNads');
    
    return await this.publicClient.readContract({
      address: contractAddress,
      abi: AllNadsABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address as `0x${string}`, index],
    }) as bigint;
  }

  /**
   * Get account address for a token
   */
  public async getAccountForToken(tokenId: bigint): Promise<string> {
    const contractAddress = this.getContractAddress('allNads');
    
    return await this.publicClient.readContract({
      address: contractAddress,
      abi: AllNadsABI,
      functionName: 'accountForToken',
      args: [tokenId],
    }) as string;
  }
}

export const blockchainService = BlockchainService.getInstance(); 