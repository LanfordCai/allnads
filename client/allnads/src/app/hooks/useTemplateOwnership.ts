import { useState, useEffect, useCallback } from 'react';
import { blockchainService } from '../services/blockchain';

// Define the return type for template ownership data
export interface TemplateOwnershipData {
  ownedTemplates: Record<string, bigint>; // Map of template IDs to token IDs
  isLoading: boolean;
  error: Error | null;
  checkOwnership: (nftAccountAddress: string, forceRefresh?: boolean) => Promise<void>;
  clearOwnership: () => void;
  userOwnsTemplate: (templateId: bigint) => boolean;
}

// Create a singleton instance to store the data across components
let globalOwnedTemplates: Record<string, bigint> = {};
let lastCheckedAccount: string | null = null;
let lastCheckedTimestamp: number = 0;
const CACHE_TTL_MS: number = 5 * 60 * 1000; // 5 minutes cache

/**
 * Hook to manage template ownership data
 * @returns TemplateOwnershipData object with ownership information and methods
 */
export function useTemplateOwnership(): TemplateOwnershipData {
  const [ownedTemplates, setOwnedTemplates] = useState<Record<string, bigint>>(globalOwnedTemplates);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  /**
   * Check if the NFT account owns a specific template
   * @param templateId The template ID to check
   * @returns boolean indicating if the user owns the template
   */
  const userOwnsTemplate = useCallback((templateId: bigint): boolean => {
    return ownedTemplates[templateId.toString()] !== undefined;
  }, [ownedTemplates]);
  
  /**
   * Clear the ownership data
   */
  const clearOwnership = useCallback(() => {
    globalOwnedTemplates = {};
    lastCheckedAccount = null;
    lastCheckedTimestamp = 0;
    setOwnedTemplates({});
  }, []);
  
  /**
   * Check template ownership for a specific NFT account
   * @param nftAccountAddress The NFT account address to check
   * @param forceRefresh Whether to force a refresh of the data, bypassing the cache
   */
  const checkOwnership = useCallback(async (nftAccountAddress: string, forceRefresh: boolean = false) => {
    if (!nftAccountAddress) {
      console.log('checkTemplateOwnership: nftAccountAddress is empty, skipping ownership check');
      return;
    }
    
    // Check if we already have fresh data for this account
    const now = Date.now();
    if (
      !forceRefresh &&
      lastCheckedAccount === nftAccountAddress && 
      Object.keys(globalOwnedTemplates).length > 0 &&
      (now - lastCheckedTimestamp) < CACHE_TTL_MS
    ) {
      console.log('Using cached template ownership data for:', nftAccountAddress, 'globalOwnedTemplates:', globalOwnedTemplates);
      setOwnedTemplates(globalOwnedTemplates);
      return;
    }
    
    console.log(`Checking template ownership for address: ${nftAccountAddress}${forceRefresh ? ' (forced refresh)' : ''}`);
    setIsLoading(true);
    setError(null);
    
    try {
      const ownedTemplatesData = await blockchainService.getAllOwnedTemplates(nftAccountAddress);
      console.log('Received template ownership data:', ownedTemplatesData);
      
      // Create a map of template IDs to token IDs
      const ownedTemplatesMap: Record<string, bigint> = {};
      
      // Process the results
      for (let i = 0; i < ownedTemplatesData.templateIds.length; i++) {
        const templateId = ownedTemplatesData.templateIds[i];
        const tokenId = ownedTemplatesData.tokenIds[i];
        ownedTemplatesMap[templateId.toString()] = tokenId;
      }
      
      // Update global state
      globalOwnedTemplates = ownedTemplatesMap;
      lastCheckedAccount = nftAccountAddress;
      lastCheckedTimestamp = now;
      
      // Update component state
      setOwnedTemplates(ownedTemplatesMap);
      console.log('Owned templates by NFT account:', ownedTemplatesMap, 'globalOwnedTemplates updated:', globalOwnedTemplates);
    } catch (err) {
      console.error('Error checking template ownership:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    ownedTemplates,
    isLoading,
    error,
    checkOwnership,
    clearOwnership,
    userOwnsTemplate
  };
} 