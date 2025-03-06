import { Template } from '../types/template.js';

/**
 * TemplateCache class for fetching and caching templates from the API
 * Templates are fetched once at server start and used until server restart
 */
export class TemplateCache {
  private templatesCache: Record<string, Template[]> | null = null;
  private readonly RETRY_DELAY_MS: number = 60 * 1000; // 1 minute retry delay
  private isRetrying: boolean = false;
  private apiUrl: string;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || process.env.ALLNADS_SERVER_API_URL || '';
    if (!this.apiUrl) {
      console.warn('[TemplateCache] No API URL provided, template fetching will fail');
    }
  }

  /**
   * Fetch all templates from the API and cache them
   * This is called once at server start and the cache persists until server restart
   */
  public async fetchAllTemplates(): Promise<Record<string, Template[]>> {
    // If templates are already cached, return them
    if (this.templatesCache) {
      console.log('[TemplateCache] Using cached templates data');
      return this.templatesCache;
    }

    try {
      console.log('[TemplateCache] Fetching templates from API');
      const response = await fetch(`${this.apiUrl}/api/nft/templates`);
      
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
      
      // Store in cache
      this.templatesCache = processedTemplates;
      console.log(`[TemplateCache] Templates cached successfully at ${new Date().toLocaleTimeString()}`);
      
      return processedTemplates;
    } catch (error) {
      console.error(`[TemplateCache] Error fetching templates: ${error instanceof Error ? error.message : String(error)}`);
      
      // Schedule retry if not already retrying
      if (!this.isRetrying) {
        this.scheduleRetry();
      }
      
      throw error;
    }
  }

  /**
   * Schedule a retry after failure
   */
  private scheduleRetry(): void {
    this.isRetrying = true;
    console.log(`[TemplateCache] Scheduling retry in ${this.RETRY_DELAY_MS / 1000} seconds`);
    
    setTimeout(async () => {
      try {
        console.log('[TemplateCache] Retrying template fetch');
        await this.fetchAllTemplates();
        this.isRetrying = false;
      } catch (error) {
        console.error('[TemplateCache] Retry failed, scheduling another retry');
        this.scheduleRetry(); // Schedule another retry
      }
    }, this.RETRY_DELAY_MS);
  }

  /**
   * Get templates by type
   */
  public async getTemplatesByType(typeName: string): Promise<Template[]> {
    const templates = await this.fetchAllTemplates();
    return templates[typeName] || [];
  }

  /**
   * Get a template by ID
   */
  public async getTemplateById(templateId: bigint): Promise<Template | null> {
    const templates = await this.fetchAllTemplates();
    
    for (const typeTemplates of Object.values(templates)) {
      const found = typeTemplates.find(template => template.id === templateId);
      if (found) return found;
    }
    
    return null;
  }
} 