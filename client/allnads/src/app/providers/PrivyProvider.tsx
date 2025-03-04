"use client";

import { ReactNode } from 'react';
import { PrivyProvider as PrivyAuthProvider } from '@privy-io/react-auth';
import { defineChain } from 'viem';

// Define Monad Testnet chain
const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  network: 'monadTestnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC || 'https://rpc.testnet.monad.xyz/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com/',
    },
  },
});

interface PrivyProviderProps {
  children: ReactNode;
}

export default function PrivyProvider({ children }: PrivyProviderProps) {
  // Get Privy App ID from environment variables
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  
  // If App ID is not set, issue a warning to the console
  if (!appId) {
    console.warn('Privy App ID is not set. Please set NEXT_PUBLIC_PRIVY_APP_ID in your .env.local file.');
  }
  
  return (
    <PrivyAuthProvider
      appId={appId || 'placeholder-app-id'} // Use App ID from environment variables, or a placeholder if not set
      config={{
        // Customize Privy appearance in the application
        appearance: {
          theme: 'light',
          accentColor: '#3B82F6', // Use blue as accent color, consistent with existing UI
          logo: '/logo.png', // Please replace with your actual logo URL
        },
        // Create embedded wallets for users without wallets
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        // Login method configuration
        loginMethods: ['email', 'wallet'],
        // Configure default chain and supported chains
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
      }}
    >
      {children}
    </PrivyAuthProvider>
  );
} 