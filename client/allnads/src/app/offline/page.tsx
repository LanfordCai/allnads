"use client";

import Image from 'next/image';
import Footer from '../components/Footer';

export default function Offline() {
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
            priority
          />
        </div>
        
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">{`You're Offline`}</h1>
        <p className="text-lg text-gray-600 mb-8 text-center">
          Please check your internet connection and try again.
        </p>
        
        <button 
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-[#8B5CF6] text-white font-medium rounded-lg hover:bg-[#7C3AED] transition-colors"
        >
          Try Again
        </button>
        
        <Footer className="mt-8" />
      </div>
    </div>
  );
} 