import React from 'react';

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  return (
    <div className={`text-center text-sm ${className}`}>
      <a href="https://x.com/33_labs" target="_blank" rel="noopener noreferrer" className="text-[#7E22CE] hover:text-[#5B21B6] transition-colors">
        Created by <span className="font-bold">@33_labs</span> with 💜
      </a>
    </div>
  );
} 