"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatBot from '../components/ChatBot';
import AuthGuard from '../components/AuthGuard';
import AppHeader from '../components/AppHeader';
import { usePrivyAuth } from '../hooks/usePrivyAuth';
import { createPublicClient, http, Address } from 'viem';
import AllNadsABI from '../contracts/AllNads.json';

// Define Monad Testnet chain
const monadChain = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC || 'https://rpc.testnet.monad.xyz/'] }
  }
};

// Contract address for AllNads
const ALLNADS_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as string;

export default function AppPage() {
  const { user, isAuthenticated, isLoading } = usePrivyAuth();
  const router = useRouter();
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [isCheckingNFT, setIsCheckingNFT] = useState(true);
  
  useEffect(() => {
    // Check if user has an AllNads NFT
    async function checkAndFetchNFT() {
      if (!isAuthenticated || !user?.wallet?.address) {
        return;
      }
      
      setIsCheckingNFT(true);
      
      try {
        // Create public client
        const publicClient = createPublicClient({
          chain: monadChain,
          transport: http(),
        });
        
        // Check if user has any AllNads NFTs
        console.log("ALLNADS_CONTRACT_ADDRESS", ALLNADS_CONTRACT_ADDRESS);
        const balance = await publicClient.readContract({
          address: ALLNADS_CONTRACT_ADDRESS as Address,
          abi: AllNadsABI,
          functionName: 'balanceOf',
          args: [user.wallet.address as Address],
        });
        
        // If user doesn't have any NFTs, redirect to airdrop page
        if (Number(balance) === 0) {
          console.log('User has no AllNads NFTs. Redirecting to airdrop page');
          router.push('/airdrop');
          return;
        }
        
        // Get the first NFT token ID
        const tokenId = await publicClient.readContract({
          address: ALLNADS_CONTRACT_ADDRESS as Address,
          abi: AllNadsABI,
          functionName: 'tokenOfOwnerByIndex',
          args: [user.wallet.address as Address, 0],
        });
        
        // Get token URI
        console.log("tokenId", tokenId);
        const tokenURI = await publicClient.readContract({
          address: ALLNADS_CONTRACT_ADDRESS as Address,
          abi: AllNadsABI,
          functionName: 'tokenURI',
          args: [tokenId],
        }) as string;
        console.log("tokenURI", tokenURI);
        // Parse tokenURI (it's likely base64 encoded JSON)
        const jsonData = tokenURI.replace('data:application/json,', '');
        const json = JSON.parse(jsonData);
        
        // Extract image from tokenURI (which is also base64 encoded)
        if (json.image) {
          setAvatarImage(json.image);
        }
      } catch (error) {
        console.error('Error checking NFT:', error);
      } finally {
        setIsCheckingNFT(false);
      }
    }
    
    checkAndFetchNFT();
  }, [isAuthenticated, user, router]);

  // Provide avatar image to ChatBot component
  return (
    <AuthGuard>
      <div className="flex flex-col h-screen bg-gray-50">
        <AppHeader />
        <main className="flex-1 overflow-hidden">
          <ChatBot avatarImage={avatarImage} isLoadingAvatar={isCheckingNFT} />
        </main>
      </div>
    </AuthGuard>
  );
} 