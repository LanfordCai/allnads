import { createPublicClient, http, PublicClient } from 'viem';
import { networks } from '../config/networks';

export function getPublicClient(networkName: keyof typeof networks = 'monadTestnet'): PublicClient {
  const network = networks[networkName];
  if (!network) {
    throw new Error(`Network ${networkName} not found in configuration`);
  }

  return createPublicClient({
    chain: network,
    transport: http(network.rpcUrls.default.http[0])
  });
} 