import { useEffect, useState, useRef } from 'react';
import { useAllNads } from './useAllNads';
import { ChatService } from '../services/ChatService';
import { blockchainService, AvatarData } from '../services/blockchain';

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
        console.log(`[NFT] Setting NFT info for token ${tokenId} and account ${nftAccount}`);
        
        // 1. 预加载模板缓存（如果尚未加载）
        try {
          await blockchainService.fetchAllTemplatesFromAPI();
        } catch (cacheError) {
          console.warn('[NFT] Failed to preload templates cache:', cacheError);
          // 继续执行，因为我们有回退机制
        }
        
        // 2. 获取用户所有组件的映射关系
        const componentsMap = await blockchainService.getUserComponentsMap(nftAccount);
        console.log(`[NFT] Got components map with ${componentsMap.size} entries`);
        
        // 3. 获取头像数据
        const avatar: AvatarData = await blockchainService.getAvatarData(tokenId);
        console.log(`[NFT] Got avatar data for token ${tokenId}:`, avatar);

        // 定义组件类型
        const componentTypes = [
          { id: avatar.backgroundId, type: 'background' },
          { id: avatar.hairstyleId, type: 'hairstyle' },
          { id: avatar.eyesId, type: 'eyes' },
          { id: avatar.mouthId, type: 'mouth' },
          { id: avatar.accessoryId, type: 'accessory' }
        ];

        // 4. 直接获取所有模板信息（使用优化的方法）
        const templatePromises = componentTypes.map(component => ({
          component,
          promise: blockchainService.getTemplateByTokenId(component.id, componentsMap)
        }));
        
        // 等待所有模板信息获取完成
        const templates = await Promise.all(
          templatePromises.map(async ({ component, promise }) => {
            try {
              const template = await promise;
              if (!template) {
                console.error(`[NFT] No template found for ${component.type} (tokenId: ${component.id})`);
                return null;
              }
              return { component, template, templateId: template.id };
            } catch (err) {
              console.error(`[NFT] Error getting template for ${component.type}:`, err);
              return null;
            }
          })
        );
        
        // 过滤掉失败的模板获取
        const validTemplates = templates.filter(item => item !== null);
        console.log(`[NFT] Got ${validTemplates.length} valid templates out of ${componentTypes.length} components`);
        
        // 创建新的元数据结构
        const enhancedMetadata: Partial<EnhancedMetadata> = {
          name: avatar.name || ''
        };
        
        // 添加模板信息到元数据
        validTemplates.forEach(item => {
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
            
            // 将组件信息添加到相应字段
            if (componentType === 'background' || 
                componentType === 'hairstyle' || 
                componentType === 'eyes' || 
                componentType === 'mouth' || 
                componentType === 'accessory') {
              enhancedMetadata[componentType] = componentInfo;
            }
          }
        });

        // 在聊天服务中设置 NFT 信息
        chatService.setNFTInfo(tokenId, nftAccount, enhancedMetadata);
        setIsNftInfoSet(true);
        
        // 检查会话 ID 是否已更改
        const currentSessionId = chatService.getSessionId();
        if (currentSessionId !== lastSessionIdRef.current) {
          lastSessionIdRef.current = currentSessionId;
          console.log(`[NFT] Session ID changed to ${currentSessionId}, reconnecting...`);
        }
        
        // 现在 NFT 信息已设置，如果尚未连接，则连接到 WebSocket
        if (!isConnectingRef.current) {
          try {
            isConnectingRef.current = true;
            await chatService.connect();
            console.log('[NFT] Connected to WebSocket after setting NFT info');
          } catch (connectError) {
            console.error('[NFT] Failed to connect to WebSocket after setting NFT info:', connectError);
          } finally {
            isConnectingRef.current = false;
          }
        } else {
          console.log('[NFT] Already connecting to WebSocket, skipping duplicate connection attempt');
        }
      } catch (err) {
        console.error('[NFT] Error getting NFT metadata:', err);
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