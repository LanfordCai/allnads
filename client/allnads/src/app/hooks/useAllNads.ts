import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { blockchainService } from '../services/blockchain';
import AllNadsABI from '../contracts/AllNads.json';
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
        const publicClient = blockchainService.getPublicClient();
        const contractAddress = blockchainService.getContractAddress('allNads');

        // Check NFT balance
        const balance = await publicClient.readContract({
          address: contractAddress,
          abi: AllNadsABI,
          functionName: 'balanceOf',
          args: [user.wallet.address as Address],
        });

        if (Number(balance) === 0) {
          setError('No AllNads NFT found');
          setNftAccount(null);
          setTokenId(null);
          return;
        }

        // Get token ID
        const tokenId = await publicClient.readContract({
          address: contractAddress,
          abi: AllNadsABI,
          functionName: 'tokenOfOwnerByIndex',
          args: [user.wallet.address as Address, 0],
        });

        setTokenId(String(tokenId));

        // Get account address
        const accountAddress = await publicClient.readContract({
          address: contractAddress,
          abi: AllNadsABI,
          functionName: 'accountForToken',
          args: [tokenId],
        });

        setNftAccount(accountAddress as string);
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