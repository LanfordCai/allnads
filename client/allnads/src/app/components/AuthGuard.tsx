"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import Image from 'next/image';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = usePrivyAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 如果认证加载完成且用户未登录，重定向到登录页
    if (!isLoading && !isAuthenticated) {
      console.log(`User not authenticated, redirecting to login from ${pathname}`);
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  // 如果正在加载或未登录，不显示子组件
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#F9FAFB] to-[#F3F4F6] px-4">
        <div className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#8B5CF6] overflow-hidden border-4 border-[#8B5CF6] w-full max-w-md p-8">
          {/* Logo */}
          <div className="w-24 h-24 bg-[#8B5CF6] rounded-xl flex items-center justify-center mb-6 mx-auto shadow-[4px_4px_0px_0px_#7C3AED] overflow-hidden border-4 border-[#7C3AED]">
            <Image 
              src="/allnads.jpg" 
              alt="AllNads Logo" 
              width={96} 
              height={96}
              className="object-cover"
            />
          </div>
          
          <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">AllNads</h1>
          <p className="text-lg text-gray-600 mb-8 text-center">Degen AI Buddy for Everyone</p>
          
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#8B5CF6] mt-6"></div>
            <p className="mt-4 text-gray-500">Verifying authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // 已登录，渲染子组件
  return <>{children}</>;
} 