import { useEffect, useState, useRef } from 'react';
import { useAllNads } from './useAllNads';
import { ChatService } from '../services/ChatService';
import { blockchainService } from '../services/blockchain';
import { Address } from 'viem';

// Define the Avatar type based on the contract structure
interface Avatar {
  name: string;
  backgroundId: bigint;
  hairstyleId: bigint;
  eyesId: bigint;
  mouthId: bigint;
  accessoryId: bigint;
}

// Define the Template type based on the contract structure
interface Template {
  name: string;
  creator: Address;
  maxSupply: bigint;
  currentSupply: bigint;
  price: bigint;
  imageData: string;
  isActive: boolean;
  componentType: number;
}

// Define the component template info for our metadata
interface ComponentTemplateInfo {
  templateId: string;
  name: string;
  creator: string;
  price: string;
  componentType: string;
}

// Define the component info with template
interface ComponentWithTemplate {
  tokenId: string;
  template: ComponentTemplateInfo;
}

// Define the enhanced metadata structure
interface EnhancedMetadata {
  name: string;
  background: ComponentWithTemplate;
  hairstyle: ComponentWithTemplate;
  eyes: ComponentWithTemplate;
  mouth: ComponentWithTemplate;
  accessory: ComponentWithTemplate;
}

/**
 * Hook that combines the AllNads NFT information with the ChatService
 * @param chatService The ChatService instance
 */
export function useChatWithNFT(chatService: ChatService) {
  const { nftAccount, tokenId, isLoading, error } = useAllNads();
  const [isNftInfoSet, setIsNftInfoSet] = useState(false);
  const lastSessionIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    async function setNFTInfo() {
      if (!tokenId || !nftAccount) {
        // Clear NFT info if not available
        chatService.setNFTInfo(null, null, null);
        setIsNftInfoSet(false);
        return;
      }

      try {
        // Get component contract address
        const componentContractAddress = await blockchainService.getComponentContractAddress();

        // Get avatar data
        const avatar = await blockchainService.getAvatarData(tokenId);

        // Define component types
        const componentTypes = [
          { id: avatar.backgroundId, type: 'background' },
          { id: avatar.hairstyleId, type: 'hairstyle' },
          { id: avatar.eyesId, type: 'eyes' },
          { id: avatar.mouthId, type: 'mouth' },
          { id: avatar.accessoryId, type: 'accessory' }
        ];

        // Step 1: Get all template IDs in parallel
        const templateIdPromises = componentTypes.map(component => ({
          component,
          promise: blockchainService.getTokenTemplate(component.id)
        }));
        
        // Wait for all template IDs to be fetched
        const templateIds = await Promise.all(
          templateIdPromises.map(async ({ component, promise }) => {
            try {
              const templateId = await promise;
              return { component, templateId };
            } catch (err) {
              console.error(`Error getting template ID for ${component.type}:`, err);
              return null;
            }
          })
        );
        
        // Filter out failed template ID fetches
        const validTemplateIds = templateIds.filter(item => item !== null);
        
        // Step 2: Get all template details in parallel
        const templatePromises = validTemplateIds.map(item => ({
          component: item!.component,
          templateId: item!.templateId,
          promise: blockchainService.getTemplateById(item!.templateId)
        }));
        
        // Wait for all template information to be fetched
        const templates = await Promise.all(
          templatePromises.map(async ({ component, templateId, promise }) => {
            try {
              const template = await promise;
              return { component, templateId, template };
            } catch (err) {
              console.error(`Error getting template information for ${component.type}:`, err);
              return null;
            }
          })
        );
        
        // Create new metadata structure
        const enhancedMetadata: Partial<EnhancedMetadata> = {
          name: avatar.name
        };
        
        // Add template information to metadata
        templates.forEach(item => {
          if (item) {
            const componentType = item.component.type;
            const componentInfo: ComponentWithTemplate = {
              tokenId: item.component.id.toString(),
              template: {
                templateId: item.templateId.toString(),
                name: item.template.name,
                creator: item.template.creator,
                price: item.template.price.toString(),
                componentType: item.template.componentType.toString()
              }
            };
            
            // Add component information to corresponding field
            enhancedMetadata[componentType as keyof EnhancedMetadata] = componentInfo as any;
          }
        });

        // Set NFT info in chat service
        chatService.setNFTInfo(tokenId, nftAccount, enhancedMetadata);
        setIsNftInfoSet(true);
        
        // Check if session ID has changed
        const currentSessionId = chatService.getSessionId();
        if (currentSessionId !== lastSessionIdRef.current) {
          lastSessionIdRef.current = currentSessionId;
          console.log(`Session ID changed to ${currentSessionId}, reconnecting...`);
        }
        
        // Now that NFT info is set, connect to the WebSocket if not already connecting
        if (!isConnectingRef.current) {
          try {
            isConnectingRef.current = true;
            await chatService.connect();
            console.log('Connected to WebSocket after setting NFT info');
          } catch (connectError) {
            console.error('Failed to connect to WebSocket after setting NFT info:', connectError);
          } finally {
            isConnectingRef.current = false;
          }
        } else {
          console.log('Already connecting to WebSocket, skipping duplicate connection attempt');
        }
      } catch (err) {
        console.error('Error getting NFT metadata:', err);
        setIsNftInfoSet(false);
      }
    }

    if (!isLoading) {
      setNFTInfo();
    }
  }, [chatService, nftAccount, tokenId, isLoading]);

  // Also reconnect when the session ID changes
  useEffect(() => {
    const currentSessionId = chatService.getSessionId();
    console.log(`[useChatWithNFT] Checking session ID: current=${currentSessionId}, last=${lastSessionIdRef.current}, isNftInfoSet=${isNftInfoSet}`);
    
    if (isNftInfoSet && currentSessionId !== lastSessionIdRef.current && !isConnectingRef.current) {
      lastSessionIdRef.current = currentSessionId;
      console.log(`[useChatWithNFT] Session ID changed to ${currentSessionId}, reconnecting with NFT info...`);
      
      // Reconnect with the new session ID if not already connecting
      isConnectingRef.current = true;
      chatService.connect()
        .then(() => {
          console.log('[useChatWithNFT] Successfully reconnected with new session ID');
        })
        .catch(error => {
          console.error('[useChatWithNFT] Failed to reconnect with new session ID:', error);
        })
        .finally(() => {
          isConnectingRef.current = false;
        });
    }
  }, [chatService, isNftInfoSet, chatService.getSessionId()]);

  return {
    nftAccount,
    tokenId,
    isLoading,
    error,
    isNftInfoSet
  };
} 