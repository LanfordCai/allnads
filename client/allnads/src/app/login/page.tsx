"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyAuth } from '../hooks/usePrivyAuth';

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = usePrivyAuth();
  const router = useRouter();

  // 如果用户已登录，自动重定向到应用页面
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 px-4">
      {/* Logo */}
      <div className="w-24 h-24 bg-black rounded-md flex items-center justify-center mb-6">
        <div className="w-12 h-12 bg-white rotate-45"></div>
      </div>
      
      {/* Welcome Text */}
      <h1 className="text-4xl font-bold mb-2 text-center">AllNads</h1>
      <p className="text-xl text-gray-600 mb-12 text-center">Your Web3 Gateway</p>
      
      {/* Single Login Button */}
      <button 
        onClick={() => login()}
        className="px-8 py-4 bg-black text-white text-lg font-medium rounded-full hover:bg-gray-900 transition-colors shadow-lg"
      >
        Start Now
      </button>
      
      {/* Terms */}
      <div className="mt-12 text-sm text-center text-gray-500 max-w-md">
        <p>
          By continuing, you agree to the{' '}
          <a href="#" className="underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
} 