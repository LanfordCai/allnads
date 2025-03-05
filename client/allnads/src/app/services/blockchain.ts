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
  private requestLog: Array<{
    id: number;
    method: string;
    params: unknown;
    timestamp: string;
    result?: unknown;
    error?: unknown;
    duration?: number;
  }> = [];
  
  // 添加模板缓存相关属性
  private templatesCache: Record<string, Template[]> | null = null;
  private templatesCacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS: number = 3600000; // 缓存有效期：1小时

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
   * Get the request log
   */
  public getRequestLog(): Array<{
    id: number;
    method: string;
    params: unknown;
    timestamp: string;
    result?: unknown;
    error?: unknown;
    duration?: number;
  }> {
    return this.requestLog;
  }

  /**
   * Display the request log in a user-friendly format
   */
  public displayRequestLog(): void {
    console.group('Blockchain Request Log');
    console.log(`Total requests: ${this.requestLog.length}`);
    
    if (this.requestLog.length === 0) {
      console.log('No requests logged yet.');
    } else {
      this.requestLog.forEach(entry => {
        console.group(`Request #${entry.id}: ${entry.method}`);
        console.log(`Time: ${entry.timestamp}`);
        console.log(`Parameters:`, entry.params);
        
        if (entry.result !== undefined) {
          console.log(`Result:`, entry.result);
        }
        
        if (entry.error !== undefined) {
          console.log(`Error:`, entry.error);
        }
        
        if (entry.duration !== undefined) {
          console.log(`Duration: ${entry.duration.toFixed(2)}ms`);
        }
        
        console.groupEnd();
      });
    }
    
    console.groupEnd();
  }

  /**
   * Export the request log to a downloadable JSON file
   */
  public exportRequestLog(): void {
    if (typeof window === 'undefined') {
      console.error('Export function is only available in browser environment');
      return;
    }

    try {
      // Create a formatted log with readable timestamps and durations
      const formattedLog = this.requestLog.map(entry => ({
        ...entry,
        duration: entry.duration ? `${entry.duration.toFixed(2)}ms` : undefined
      }));

      // Convert to JSON string with pretty formatting
      const jsonString = JSON.stringify(formattedLog, null, 2);
      
      // Create a blob with the JSON data
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a link element
      const link = document.createElement('a');
      
      // Set link properties
      link.href = url;
      link.download = `blockchain-requests-${new Date().toISOString().replace(/:/g, '-')}.json`;
      
      // Append link to body
      document.body.appendChild(link);
      
      // Click the link to trigger download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Request log exported successfully');
    } catch (error) {
      console.error('Failed to export request log', error);
    }
  }

  /**
   * Clear the request log
   */
  public clearRequestLog(): void {
    this.requestLog = [];
    console.log('Request log cleared');
  }

  /**
   * Wraps a blockchain call with rate limiting, retry logic, and logging
   * @param fn Function to wrap
   * @returns Rate-limited and retry-enabled function
   */
  private wrapBlockchainCall<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, methodName: string): T {
    const wrappedFn = async (...args: unknown[]): Promise<unknown> => {
      this.callCounter++;
      const requestId = this.callCounter;
      const startTime = performance.now();
      const timestamp = new Date().toISOString();
      
      // Log the request
      const requestInfo = {
        id: requestId,
        method: methodName,
        params: args.length > 0 ? args : 'No parameters',
        timestamp,
      };
      
      this.requestLog.push(requestInfo);
      console.log(`[Blockchain Request #${requestId}] ${methodName}`, {
        params: args.length > 0 ? args : 'No parameters',
        timestamp
      });
      
      try {
        const result = await fn(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Update the log with the result
        const logEntry = this.requestLog.find(entry => entry.id === requestId);
        if (logEntry) {
          logEntry.result = result;
          logEntry.duration = duration;
        }
        
        console.log(`[Blockchain Response #${requestId}] ${methodName}`, {
          result,
          duration: `${duration.toFixed(2)}ms`
        });
        
        return result;
      } catch (err) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Update the log with the error
        const logEntry = this.requestLog.find(entry => entry.id === requestId);
        if (logEntry) {
          logEntry.error = err;
          logEntry.duration = duration;
        }
        
        console.error(`[Blockchain Error #${requestId}] ${methodName}`, {
          error: err,
          duration: `${duration.toFixed(2)}ms`
        });
        
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
    // 检查缓存是否有效
    if (this.templatesCache && (Date.now() - this.templatesCacheTimestamp) < this.CACHE_TTL_MS) {
      console.log('[Templates] Using cached templates data');
      return this.templatesCache;
    }

    try {
      console.log('[Templates] Fetching templates from API');
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
      
      // 更新缓存
      this.templatesCache = processedTemplates;
      this.templatesCacheTimestamp = Date.now();
      console.log(`[Templates] Templates cached at ${new Date(this.templatesCacheTimestamp).toLocaleTimeString()}`);
      
      return processedTemplates;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clear the templates cache to force a fresh fetch on next request
   */
  public clearTemplatesCache(): void {
    this.templatesCache = null;
    this.templatesCacheTimestamp = 0;
    console.log('[Templates] Templates cache cleared');
  }

  /**
   * Get the template cache status
   */
  public getTemplatesCacheStatus(): { isCached: boolean, timestamp: number, age: number } {
    const now = Date.now();
    const age = now - this.templatesCacheTimestamp;
    return {
      isCached: this.templatesCache !== null,
      timestamp: this.templatesCacheTimestamp,
      age: age
    };
  }

  /**
   * Find a template by ID in the cache
   * If not found in cache, falls back to blockchain call
   */
  public async findTemplateById(templateId: bigint): Promise<Template | null> {
    // 尝试从缓存中查找
    if (this.templatesCache) {
      // 遍历所有类型的模板
      for (const typeTemplates of Object.values(this.templatesCache)) {
        // 在当前类型中查找匹配的模板
        const template = typeTemplates.find(t => t.id === templateId);
        if (template) {
          console.log(`[Templates] Found template ${templateId.toString()} in cache`);
          return template;
        }
      }
      console.log(`[Templates] Template ${templateId.toString()} not found in cache, fetching from blockchain`);
    } else {
      console.log(`[Templates] Cache not initialized, fetching template ${templateId.toString()} from blockchain`);
    }

    // 如果缓存中没有找到，从区块链获取
    try {
      return await this.getTemplateById(templateId);
    } catch (error) {
      console.error(`Error fetching template ${templateId.toString()} from blockchain:`, error);
      return null;
    }
  }

  /**
   * 获取用户所有组件的映射关系
   * 返回一个映射：tokenId -> { templateId, templateType }
   */
  public async getUserComponentsMap(address: string): Promise<Map<string, { templateId: bigint, templateType: number }>> {
    console.log(`[Templates] Getting components map for address ${address}`);
    
    try {
      // 获取用户拥有的所有模板
      const ownedTemplates = await this.getAllOwnedTemplates(address);
      
      // 创建映射：tokenId -> { templateId, templateType }
      const componentsMap = new Map<string, { templateId: bigint, templateType: number }>();
      
      // 填充映射
      for (let i = 0; i < ownedTemplates.tokenIds.length; i++) {
        const tokenId = ownedTemplates.tokenIds[i].toString();
        const templateId = ownedTemplates.templateIds[i];
        const templateType = ownedTemplates.templateTypes[i];
        
        componentsMap.set(tokenId, { templateId, templateType });
      }
      
      console.log(`[Templates] Found ${componentsMap.size} components for address ${address}`);
      return componentsMap;
    } catch (error) {
      console.error(`Error getting components map for address ${address}:`, error);
      return new Map();
    }
  }

  /**
   * 根据 tokenId 查找对应的模板信息
   * 优先使用用户组件映射，如果没有则回退到区块链调用
   */
  public async getTemplateByTokenId(
    tokenId: bigint, 
    componentsMap?: Map<string, { templateId: bigint, templateType: number }>
  ): Promise<Template | null> {
    const tokenIdStr = tokenId.toString();
    console.log(`[Templates] Getting template for token ID ${tokenIdStr}`);
    
    // 如果提供了组件映射，优先使用映射
    if (componentsMap && componentsMap.has(tokenIdStr)) {
      const { templateId } = componentsMap.get(tokenIdStr)!;
      console.log(`[Templates] Found template ID ${templateId.toString()} for token ID ${tokenIdStr} in components map`);
      
      // 使用模板ID查找完整模板信息
      return await this.findTemplateById(templateId);
    }
    
    // 如果没有映射或映射中没有找到，回退到区块链调用
    try {
      console.log(`[Templates] Getting template ID for token ID ${tokenIdStr} from blockchain`);
      const templateId = await this.getTokenTemplate(tokenId);
      return await this.findTemplateById(templateId);
    } catch (error) {
      console.error(`Error getting template for token ID ${tokenIdStr}:`, error);
      return null;
    }
  }
}

export const blockchainService = BlockchainService.getInstance(); 