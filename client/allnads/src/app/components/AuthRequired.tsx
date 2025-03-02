"use client";

import { ReactNode } from 'react';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import LoginButton from './LoginButton';

interface AuthRequiredProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function AuthRequired({ 
  children, 
  fallback 
}: AuthRequiredProps) {
  const { isAuthenticated, isLoading } = usePrivyAuth();

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">正在加载</h2>
          <p className="text-gray-500">请稍候...</p>
        </div>
      </div>
    );
  }

  // 如果未认证，显示登录界面
  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">需要登录</h2>
          <p className="text-gray-500 mb-6">请登录或注册以访问此内容</p>
          <LoginButton />
        </div>
      </div>
    );
  }

  // 如果已认证，显示子内容
  return <>{children}</>;
} 