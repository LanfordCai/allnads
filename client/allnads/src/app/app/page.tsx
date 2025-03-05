"use client";

import ChatBot from '../components/ChatBot';
import AuthGuard from '../components/AuthGuard';
import AppHeader from '../components/AppHeader';

export default function AppPage() {
  return (
    <AuthGuard>
      <div className="flex flex-col h-screen bg-gray-50">
        <div className="sticky top-0 z-[30] lg:z-[50]">
          <AppHeader />
        </div>
        <main className="flex-1 overflow-hidden">
          <ChatBot />
        </main>
      </div>
    </AuthGuard>
  );
} 