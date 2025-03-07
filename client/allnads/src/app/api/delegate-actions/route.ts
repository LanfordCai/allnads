import { createPrivyClient } from '@privy-io/server-auth';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

interface DelegatedWallet {
  address: string;
  chainId: number;
  delegated: boolean;
}

// Initialize the Privy client with your app's configuration
const privyClient = createPrivyClient({
  // Get these values from your Privy Dashboard
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

export async function POST(req: NextRequest) {
  try {
    const { userId, walletAddress, action } = await req.json();

    // Verify that the user has delegated their wallet
    const delegatedWallets = await privyClient.getDelegatedWallets(userId);
    const isDelegated = delegatedWallets.some((wallet: DelegatedWallet) => 
      wallet.address.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!isDelegated) {
      return NextResponse.json(
        { error: 'Wallet is not delegated to this application' },
        { status: 403 }
      );
    }

    // Example: Send a transaction using the delegated wallet
    switch (action) {
      case 'transfer': {
        const transaction = await privyClient.sendTransaction({
          chainId: 10143, // Monad Testnet
          from: walletAddress,
          to: '0x...', // recipient address
          value: '1000000000000000000', // 1 MON in wei
        });
        
        return NextResponse.json({ 
          success: true, 
          transactionHash: transaction.hash 
        });
      }

      case 'sign': {
        // Example: Sign a message
        const message = 'Hello from AllNads!';
        const signature = await privyClient.signMessage({
          chainId: 10143,
          from: walletAddress,
          message,
        });

        return NextResponse.json({ 
          success: true, 
          signature 
        });
      }

      case 'signTypedData': {
        // Example: Sign typed data (EIP-712)
        const typedData = {
          domain: {
            name: 'AllNads',
            version: '1',
            chainId: 10143,
          },
          types: {
            Action: [
              { name: 'action', type: 'string' },
              { name: 'timestamp', type: 'uint256' },
            ],
          },
          message: {
            action: 'Delegate action example',
            timestamp: Math.floor(Date.now() / 1000),
          },
        };

        const signature = await privyClient.signTypedData({
          chainId: 10143,
          from: walletAddress,
          data: typedData,
        });

        return NextResponse.json({ 
          success: true, 
          signature 
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Delegation action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute delegated action' },
      { status: 500 }
    );
  }
} 