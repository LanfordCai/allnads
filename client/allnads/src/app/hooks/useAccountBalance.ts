import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { blockchainService } from '../services/blockchain';

export function useAccountBalance(address: Address | null | undefined) {
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    async function fetchBalance() {
      setIsLoading(true);
      setError(null);

      try {
        // Type guard to ensure address is Address type
        if (typeof address === 'string' && address.startsWith('0x')) {
          const balance = await blockchainService.getBalance(address as Address);
          setBalance(balance);
        }
      } catch (err) {
        console.error('Error fetching balance:', err);
        setError('Failed to load balance');
      } finally {
        setIsLoading(false);
      }
    }

    fetchBalance();

    // Set up polling every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [address]);

  return {
    balance,
    isLoading,
    error,
  };
} 