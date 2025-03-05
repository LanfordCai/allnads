"use client";

import { usePrivyAuth } from '../hooks/usePrivyAuth';

export default function LoginButton() {
  const { isAuthenticated, login, logout, displayName } = usePrivyAuth();

  return (
    <div>
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <div className="text-sm">
            {displayName}
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Log Out
          </button>
        </div>
      ) : (
        <button
          onClick={login}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Login/Register
        </button>
      )}
    </div>
  );
} 