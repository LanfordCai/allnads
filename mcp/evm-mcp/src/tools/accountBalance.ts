import { formatEther } from 'ethers';
import { getProvider } from '../utils/ethers.js';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';

// Define the parameter type for the handler
interface AccountBalanceParams {
  address: string;
  chain?: string;
  customRpcUrl?: string;
}

/**
 * Tool for checking the balance of an Ethereum address
 */
export const evmAccountBalanceTool = {
  name: 'evm_account_balance',
  description: 'Get the balance of an Ethereum address on specified chain',
  
  parameters: z.object({
    address: z.string().describe('The Ethereum address to check'),
    chain: z.string().default('ethereum').describe('The blockchain to check (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  }),
  
  execute: async (params: AccountBalanceParams): Promise<ContentResult> => {
    try {
      const { address, chain = 'ethereum', customRpcUrl } = params;
      
      // Validate address format
      if (!address.match(/^0x[0-9a-fA-F]{40}$/)) {
        return createTextResponse(`Invalid Ethereum address format: ${address}`);
      }
      
      // Get provider for the specified chain
      const provider = getProvider(chain, customRpcUrl);
      
      // Get account balance
      const balanceWei = await provider.getBalance(address);
      const balanceEth = formatEther(balanceWei);
      
      return createTextResponse(`Balance for ${address} on ${chain}: ${balanceEth} ETH`);
    } catch (error) {
      return createTextResponse(`Error getting account balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 