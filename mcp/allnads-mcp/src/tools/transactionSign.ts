import { isAddress } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types';
import { PrivyClient, LinkedAccountWithMetadata, WalletWithMetadata } from '@privy-io/server-auth';
import { networks } from '../config/networks';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

/**
 * Tool for creating a serialized transaction to sign
 */
export const transactionSignTool = {
  name: 'transaction_sign',
  description: 'sign a transaction request',
  parameters: z.object({
    to: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid address format',
        path: ['to']
      })
      .describe('The destination address for the transaction'),
    data: z.string()
      .describe('The encoded function data for the transaction'),
    value: z.string()
      .default('0')
      .refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
        message: 'Value must be a valid non-negative number',
        path: ['value']
      })
      .describe('The native token value to send with the transaction (in wei)'),
    userId: z.string()
      .optional()
      .describe('The Privy userId for the user')
  }),
  execute: async (params: { to: string; data: string; value: string; userId?: string }): Promise<ContentResult> => {
    const { to, data, value, userId } = params;

    // If no idToken provided, return original response
    if (!userId) {
      return createTextResponse(`Waiting for signature...`);
    }

    try {
      console.log('userId', userId);
      // Get user's delegated wallets
      const user = await privy.getUser(userId);
      console.log('user.linkedAccounts', user.linkedAccounts);
      const embeddedWallets = user.linkedAccounts.filter(
        (account: LinkedAccountWithMetadata): account is WalletWithMetadata => 
          account.type === 'wallet' && account.walletClientType === 'privy'
      );
      const delegatedWallets = embeddedWallets.filter((wallet: WalletWithMetadata) => wallet.delegated);

      // If no delegated wallets, return original response
      if (delegatedWallets.length === 0) {
        return createTextResponse(`Waiting for signature...`);
      }

      // Use the first delegated wallet to send the transaction
      const wallet = delegatedWallets[0];

      console.log('wallet', wallet);
      const txResponse = await privy.walletApi.ethereum.sendTransaction({
        address: wallet.address as `0x${string}`,
        chainType: 'ethereum',
        caip2: `eip155:${networks.monadTestnet.id}`,
        transaction: {
          to: to as `0x${string}`,
          data: data as `0x${string}`,
          value: `0x${BigInt(value).toString(16)}`
        }
      });

      return createTextResponse(`Transaction sent with hash: ${txResponse.hash}`);
    } catch (error) {
      console.error('Error in delegated transaction:', error);
      return createTextResponse(`Error in delegated transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 