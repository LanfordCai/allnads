"use client";

import { usePrivy } from '@privy-io/react-auth';

export function usePrivyAuth() {
  const privy = usePrivy();
  
  return {
    // 用户状态
    isReady: privy.ready,
    isAuthenticated: privy.authenticated,
    isLoading: !privy.ready,
    user: privy.user,
    
    // 身份验证方法
    login: privy.login,
    logout: privy.logout,
    
    // 钱包相关
    wallet: privy.user?.wallet,
    wallets: privy.user?.linkedAccounts,
    
    // 用户信息
    email: privy.user?.email?.address,
    
    // 原始privy对象，用于访问更多功能
    privy,
  };
} 