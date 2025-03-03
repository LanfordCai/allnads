import { Chain } from 'viem';

export const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC || 'https://rpc.testnet.monad.xyz/'] }
  }
} as const satisfies Chain;

export const supportedChains = [monadTestnet] as const;

export type SupportedChainId = typeof supportedChains[number]['id'];

// Contract addresses
export const contractAddresses = {
  [monadTestnet.id]: {
    allNads: process.env.NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as `0x${string}`
  }
} as const; 