import { Chain } from 'viem';
import { env } from './env.js';

export const networks: Record<string, Chain> = {
  monadTestnet: {
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: {
      default: { http: [env.MONAD_TESTNET_RPC] }
    }
  }
}; 