import { type Address, isAddress, encodeFunctionData } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types';
import { getPublicClient } from '../utils/viem';
import { ERC20_TOKENS } from '../utils/supportedErc20Tokens';
import { AllNadsAccountABI } from '../abis/AllNadsAccount';

/**
 * Formats a token balance according to its decimals
 * @param balance The raw balance as a bigint
 * @param decimals The number of decimals for the token
 * @returns A formatted string representation of the balance
 */
function formatTokenBalance(balance: bigint, decimals: number): string {
  if (balance === 0n) return '0';
  
  const balanceStr = balance.toString();
  
  // If the balance is less than 10^decimals, we need to pad with leading zeros
  if (balanceStr.length <= decimals) {
    const paddedBalance = balanceStr.padStart(decimals + 1, '0');
    const integerPart = paddedBalance.slice(0, -decimals) || '0';
    const fractionalPart = paddedBalance.slice(-decimals).replace(/0+$/, '');
    
    return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
  } else {
    const integerPart = balanceStr.slice(0, balanceStr.length - decimals);
    const fractionalPart = balanceStr.slice(balanceStr.length - decimals).replace(/0+$/, '');
    
    return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
  }
}

/**
 * Tool for creating a serialized transaction to send MON tokens
 */
export const getErc20TokensTool= {
  name: 'get_erc20_tokens',
  description: `
  Get all erc20 tokens for an address, the information includes the token name, symbol, contract address, decimals and balance.
  Only Wrapped Monad(WMON) Moyaki(YAKI), Chog(CHOG), Molandak(DAK), USDT, USDC, WBTC are supported.
  Note: MON is not ERC20 token, you should use evm_tool to get the balance of MON`,
  parameters: z.object({
    address: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid address format',
        path: ['address']
      })
      .describe('The address to get the erc20 tokens for'),
  }),
  
  execute: async (params: { address: string }): Promise<ContentResult> => {
    try {
      const { address } = params;
      const publicClient = getPublicClient();
      
      // Fetch balances for all tokens
      const tokenResults = await Promise.all(
        Object.entries(ERC20_TOKENS).map(async ([name, tokenInfo]) => {
          try {
            const balance = await publicClient.readContract({
              address: tokenInfo.contractAddress,
              abi: [
                {
                  name: 'balanceOf',
                  type: 'function',
                  inputs: [{ name: 'owner', type: 'address' }],
                  outputs: [{ name: 'balance', type: 'uint256' }],
                  stateMutability: 'view'
                }
              ],
              functionName: 'balanceOf',
              args: [address as Address]
            }) as bigint;
            
            // Format balance according to decimals
            const formattedBalance = formatTokenBalance(balance, tokenInfo.decimals);
            
            return {
              ...tokenInfo,
              name,
              rawBalance: balance.toString(),
              balance: formattedBalance
            };
          } catch (error) {
            console.error(`Error fetching balance for ${name}:`, error);
            return {
              ...tokenInfo,
              name,
              rawBalance: '0',
              balance: '0',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );

      return createTextResponse(JSON.stringify(tokenResults, null, 2));
    } catch (error) {
      return createTextResponse(`Error fetching ERC20 tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 

export const transferErc20TokenTool = {
  name: 'transfer_erc20_token',
  description: 'Transfer an erc20 token to an address. You can query the address book to get the recipient address.',
  parameters: z.object({
    allnadsAccount: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid allnads account address format',
        path: ['allnadsAccount']
      })
      .describe('The allnads account of the sender'),
    token: z.string()
      .refine(input => {
        // Check if the input matches any token's name, symbol, or contract address
        return Object.entries(ERC20_TOKENS).some(([key, token]) => 
          key === input || 
          token.symbol === input || 
          token.name === input || 
          token.contractAddress === input
        );
      }, {
        message: 'Invalid token. Please provide a valid token name, symbol, or contract address',
        path: ['token']
      })
      .describe('The token to send (name, symbol, or contract address)'),
    to: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid address format',
        path: ['to']
      })
      .describe('The address to send the token to'),
    amount: z.string()
      .describe('The amount of tokens to send')
  }),

  execute: async (params: { allnadsAccount: string, token: string, to: string, amount: string }): Promise<ContentResult> => {
    try {
      const { allnadsAccount, token, to, amount } = params;
      
      // Find token info by checking name, symbol, or contract address
      let tokenInfo;
      for (const [key, info] of Object.entries(ERC20_TOKENS)) {
        if (key === token || 
            info.symbol === token || 
            info.name === token || 
            info.contractAddress === token) {
          tokenInfo = info;
          break;
        }
      }

      if (!tokenInfo) {
        return createTextResponse('Invalid token');
      }

      const transactionRequest = {
        to: allnadsAccount,
        data: encodeFunctionData({
          abi: AllNadsAccountABI,
          functionName: 'transferERC20',
          args: [tokenInfo.contractAddress, to, amount]
        })
      };

      return createTextResponse(`<<TransactionRequest>>\n${JSON.stringify(transactionRequest, null, 2)}`);
    } catch (error) {
      return createTextResponse(`Error sending erc20 token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};