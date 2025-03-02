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
  // 从环境变量中获取Privy App ID
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  
  // 如果未设置App ID，向控制台发出警告
  if (!appId) {
    console.warn('Privy App ID is not set. Please set NEXT_PUBLIC_PRIVY_APP_ID in your .env.local file.');
  }
  
  return (
    <PrivyAuthProvider
      appId={appId || 'placeholder-app-id'} // 使用环境变量中的App ID，如果未设置则使用占位符
      config={{
        // 自定义Privy在应用中的外观
        appearance: {
          theme: 'light',
          accentColor: '#3B82F6', // 使用蓝色作为强调色，与现有UI一致
          logo: '/logo.png', // 请替换为你的实际logo URL
        },
        // 为没有钱包的用户创建嵌入式钱包
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        // 登录方法配置
        loginMethods: ['email', 'wallet'],
        // 配置默认链和支持的链
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
      }}
    >
      {children}
    </PrivyAuthProvider>
  );
} 