import { useState, useEffect } from 'react';
import { blockchainService } from '../services/blockchain';
import { usePrivyAuth } from './usePrivyAuth';

export function useAllNads() {
  const { isAuthenticated, user } = usePrivyAuth();
  const [nftAccount, setNftAccount] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkNFT() {
      if (!isAuthenticated || !user?.wallet?.address) return;

      setIsLoading(true);
      setError(null);

      try {
        // Check NFT balance
        const balance = await blockchainService.getNFTBalance(user.wallet.address);

        if (Number(balance) === 0) {
          setError('No AllNads NFT found');
          setNftAccount(null);
          setTokenId(null);
          return;
        }

        // Get token ID
        const tokenId = await blockchainService.getTokenOfOwnerByIndex(user.wallet.address, 0);
        setTokenId(String(tokenId));

        // Get account address
        const accountAddress = await blockchainService.getAccountForToken(tokenId);
        setNftAccount(accountAddress);
      } catch (err) {
        console.error('Error checking NFT:', err);
        setError('Failed to load NFT data');
      } finally {
        setIsLoading(false);
      }
    }

    checkNFT();
  }, [isAuthenticated, user?.wallet?.address]);

  return {
    nftAccount,
    tokenId,
    isLoading,
    error,
  };
} 