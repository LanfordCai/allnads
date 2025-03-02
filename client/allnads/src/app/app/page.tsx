"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChatBot from '../components/ChatBot';
import AuthGuard from '../components/AuthGuard';
import AppHeader from '../components/AppHeader';
import { usePrivyAuth } from '../hooks/usePrivyAuth';

export default function AppPage() {
  const { user, isAuthenticated } = usePrivyAuth();
  const router = useRouter();
  
  return (
    <AuthGuard>
      <div className="flex flex-col h-screen bg-gray-50">
        <AppHeader />
        <main className="flex-1 overflow-hidden">
          <ChatBot />
        </main>
      </div>
    </AuthGuard>
  );
} 