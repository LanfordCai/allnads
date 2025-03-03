import { useEffect, useState, useRef } from 'react';
import { useAllNads } from './useAllNads';
import { ChatService } from '../services/ChatService';
import { blockchainService } from '../services/blockchain';
import AllNadsABI from '../contracts/AllNads.json';
import AllNadsComponentABI from '../contracts/AllNadsComponent.json';
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

// Define the component type for our metadata
interface ComponentInfo {
  templateId: string;
  name: string;
  creator: string;
  price: string;
  componentType: string;
}

// Define the enhanced metadata structure
interface EnhancedMetadata {
  name: string;
  backgroundId: string;
  hairstyleId: string;
  eyesId: string;
  mouthId: string;
  accessoryId: string;
  components: {
    [key: string]: ComponentInfo;
  };
}

/**
 * Hook that combines the AllNads NFT information with the ChatService
 * @param chatService The ChatService instance
 */
export function useChatWithNFT(chatService: ChatService) {
  const { nftAccount, tokenId, isLoading, error } = useAllNads();
  const [isNftInfoSet, setIsNftInfoSet] = useState(false);
  const lastSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function setNFTInfo() {
      if (!tokenId || !nftAccount) {
        // Clear NFT info if not available
        chatService.setNFTInfo(null, null, null);
        setIsNftInfoSet(false);
        return;
      }

      try {
        // Get NFT metadata
        const publicClient = blockchainService.getPublicClient();
        const contractAddress = blockchainService.getContractAddress('allNads');
        const componentContractAddress = await publicClient.readContract({
          address: contractAddress,
          abi: AllNadsABI,
          functionName: 'componentContract',
        }) as Address;

        // Get avatar data
        const avatar = await publicClient.readContract({
          address: contractAddress,
          abi: AllNadsABI,
          functionName: 'getAvatar',
          args: [BigInt(tokenId)],
        }) as Avatar;

        // Create enhanced metadata with template information
        const enhancedMetadata: EnhancedMetadata = {
          name: avatar.name,
          backgroundId: avatar.backgroundId.toString(),
          hairstyleId: avatar.hairstyleId.toString(),
          eyesId: avatar.eyesId.toString(),
          mouthId: avatar.mouthId.toString(),
          accessoryId: avatar.accessoryId.toString(),
          components: {}
        };

        // 定义组件类型
        const componentTypes = [
          { id: avatar.backgroundId, type: 'background', key: 'backgroundId' },
          { id: avatar.hairstyleId, type: 'hairstyle', key: 'hairstyleId' },
          { id: avatar.eyesId, type: 'eyes', key: 'eyesId' },
          { id: avatar.mouthId, type: 'mouth', key: 'mouthId' },
          { id: avatar.accessoryId, type: 'accessory', key: 'accessoryId' }
        ];

        // 第一步：并行获取所有组件的模板ID
        const templateIdPromises = componentTypes.map(component => ({
          component,
          promise: publicClient.readContract({
            address: componentContractAddress,
            abi: AllNadsComponentABI,
            functionName: 'getTokenTemplate',
            args: [component.id],
          }) as Promise<bigint>
        }));
        
        // 等待所有模板ID获取完成
        const templateIds = await Promise.all(
          templateIdPromises.map(async ({ component, promise }) => {
            try {
              const templateId = await promise;
              return { component, templateId };
            } catch (err) {
              console.error(`获取${component.type}模板ID时出错:`, err);
              return null;
            }
          })
        );
        
        // 过滤掉获取失败的模板ID
        const validTemplateIds = templateIds.filter(item => item !== null);
        
        // 第二步：并行获取所有模板的详细信息
        const templatePromises = validTemplateIds.map(item => ({
          component: item!.component,
          templateId: item!.templateId,
          promise: publicClient.readContract({
            address: componentContractAddress,
            abi: AllNadsComponentABI,
            functionName: 'getTemplate',
            args: [item!.templateId],
          }) as Promise<Template>
        }));
        
        // 等待所有模板信息获取完成
        const templates = await Promise.all(
          templatePromises.map(async ({ component, templateId, promise }) => {
            try {
              const template = await promise;
              return { component, templateId, template };
            } catch (err) {
              console.error(`获取${component.type}模板信息时出错:`, err);
              return null;
            }
          })
        );
        
        // 将模板信息添加到元数据中
        templates.forEach(item => {
          if (item) {
            enhancedMetadata.components[item.component.key] = {
              templateId: item.templateId.toString(),
              name: item.template.name,
              creator: item.template.creator,
              price: item.template.price.toString(),
              componentType: item.template.componentType.toString()
            };
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
        
        // Now that NFT info is set, connect to the WebSocket
        try {
          await chatService.connect();
          console.log('Connected to WebSocket after setting NFT info');
        } catch (connectError) {
          console.error('Failed to connect to WebSocket after setting NFT info:', connectError);
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
    if (isNftInfoSet && currentSessionId !== lastSessionIdRef.current) {
      lastSessionIdRef.current = currentSessionId;
      console.log(`Session ID changed to ${currentSessionId}, reconnecting with NFT info...`);
      
      // Reconnect with the new session ID
      chatService.connect().catch(error => {
        console.error('Failed to reconnect with new session ID:', error);
      });
    }
  }, [chatService, isNftInfoSet]);

  return {
    nftAccount,
    tokenId,
    isLoading,
    error,
    isNftInfoSet
  };
} 