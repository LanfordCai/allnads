"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyAuth } from '../hooks/usePrivyAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = usePrivyAuth();
  const router = useRouter();

  useEffect(() => {
    // 如果认证加载完成且用户未登录，重定向到登录页
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // 如果正在加载或未登录，不显示子组件
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 px-4">
        {/* Logo */}
        <div className="w-24 h-24 bg-black rounded-md flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-white rotate-45"></div>
        </div>
        
        <h1 className="text-4xl font-bold mb-2 text-center">AllNads</h1>
        <p className="text-xl text-gray-600 mb-8 text-center">Your Web3 Gateway</p>
        
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black mt-6"></div>
        <p className="mt-4 text-gray-500">Verifying authentication...</p>
      </div>
    );
  }

  // 已登录，渲染子组件
  return <>{children}</>;
} 