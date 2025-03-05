import { JsonRpcProvider, FallbackProvider, BrowserProvider } from 'ethers';
import dotenv from 'dotenv';

dotenv.config() 

// Default RPC endpoints for major EVM chains
const DEFAULT_RPC_ENDPOINTS: Record<string, string[]> = {
  'ethereum': [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth'
  ],
  'optimism': [
    'https://optimism.llamarpc.com',
    'https://rpc.ankr.com/optimism'
  ],
  'arbitrum': [
    'https://arbitrum.llamarpc.com',
    'https://rpc.ankr.com/arbitrum'
  ],
  'polygon': [
    'https://polygon.llamarpc.com',
    'https://rpc.ankr.com/polygon'
  ],
  'base': [
    'https://base.llamarpc.com',
    'https://base.rpc.ankr.com'
  ],
  'avalanche': [
    'https://avalanche.llamarpc.com',
    'https://rpc.ankr.com/avalanche'
  ],
  'monad': [
    process.env.MONAD_TESTNET_RPC!,
  ]
};

/**
 * Get a provider for a specific EVM chain
 * @param chainName The name of the chain (e.g., 'ethereum', 'polygon')
 * @param customRpcUrl Optional custom RPC URL
 * @returns An ethers.js Provider instance
 */
export function getProvider(chainName: string, customRpcUrl?: string): JsonRpcProvider | FallbackProvider {
  if (customRpcUrl) {
    return new JsonRpcProvider(customRpcUrl);
  }
  
  const endpoints = DEFAULT_RPC_ENDPOINTS[chainName.toLowerCase()];
  
  if (!endpoints || endpoints.length === 0) {
    throw new Error(`No RPC endpoints available for chain: ${chainName}`);
  }
  
  console.log(endpoints);

  if (endpoints.length === 1) {
    return new JsonRpcProvider(endpoints[0]);
  }
  
  // Create providers for each endpoint
  const providers = endpoints.map(endpoint => new JsonRpcProvider(endpoint));
  
  // Create a fallback provider that will try each provider in sequence
  return new FallbackProvider(providers);
} 