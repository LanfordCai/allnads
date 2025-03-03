"use client";

import { PrivyInterface } from '@privy-io/react-auth';

interface AuthStatusPanelProps {
  authStatus: 'authenticated' | 'anonymous' | 'pending';
  isAuthenticated: boolean;
  privy: PrivyInterface;
}

export function AuthStatusPanel({
  authStatus,
  isAuthenticated,
  privy
}: AuthStatusPanelProps) {
  return (
    <div className="mt-4 p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-medium">认证状态</h3>
        <span className={`px-2 py-1 text-xs rounded-full ${
          authStatus === 'authenticated' 
            ? 'bg-green-100 text-green-800' 
            : authStatus === 'anonymous' 
              ? 'bg-yellow-100 text-yellow-800' 
              : 'bg-gray-100 text-gray-800'
        }`}>
          {authStatus === 'authenticated' 
            ? '已认证' 
            : authStatus === 'anonymous' 
              ? '匿名' 
              : '加载中'}
        </span>
      </div>
      
      {authStatus === 'authenticated' ? (
        <button
          onClick={() => privy.logout()}
          className="w-full py-2 px-4 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          退出登录
        </button>
      ) : (
        <button
          onClick={() => privy.login()}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          登录/注册
        </button>
      )}
      
      {isAuthenticated && (
        <div className="mt-3 text-xs text-gray-500">
          <p>登录后，你的聊天记录可以在不同设备间同步，并且不会丢失。</p>
        </div>
      )}
    </div>
  );
} 