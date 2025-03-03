import { useEffect, useState, useRef } from 'react';
import { useAllNads } from './useAllNads';
import { ChatService } from '../services/ChatService';
import { blockchainService } from '../services/blockchain';
import AllNadsABI from '../contracts/AllNads.json';

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

        // Get avatar data
        const avatar = await publicClient.readContract({
          address: contractAddress,
          abi: AllNadsABI,
          functionName: 'getAvatar',
          args: [BigInt(tokenId)],
        });

        // Set NFT info in chat service - don't include image in metadata
        chatService.setNFTInfo(tokenId, nftAccount, avatar);
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