"use client";

import { usePrivy } from '@privy-io/react-auth';

const getDisplayNameFromEmail = (email: string) => {
  return email.split('@')[0];
};

export function usePrivyAuth() {
  const privy = usePrivy();

  const email = privy.user?.linkedAccounts.find((account) => account.type === 'email');
  const google = privy.user?.linkedAccounts.find((account) => account.type === 'google_oauth');
  const twitter = privy.user?.linkedAccounts.find((account) => account.type === 'twitter_oauth');

  let displayName = '';
  if (email) {
    displayName = getDisplayNameFromEmail(email.address);
  } else if (google) {
    displayName = google.name || getDisplayNameFromEmail(google.email);
  } else if (twitter) {
    displayName = twitter.name || twitter.username || 'Anonymous';
  }
  
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
    displayName,
    
    // 原始privy对象，用于访问更多功能
    privy,
  };
} 