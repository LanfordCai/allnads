import { type Address, isAddress, encodeFunctionData } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';
import { getPublicClient } from '../utils/viem.js';

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

const ERC20_TOKENS = {
  'Wrapped Monad': {
    contractAddress: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701' as Address,
    symbol: 'WMON',
    name: 'Wrapped Monad',
    decimals: 18
  },
  'Moyaki': {
    contractAddress: '0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50' as Address,
    symbol: 'YAKI',
    name: 'Moyaki',
    decimals: 18
  },
  'Chog': {
    contractAddress: '0xE0590015A873bF326bd645c3E1266d4db41C4E6B' as Address,
    symbol: 'CHOG',
    name: 'Chog',
    decimals: 18
  },
  'Molandak': {
    contractAddress: '0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714' as Address,
    symbol: 'DAK',
    name: 'Molandak',
    decimals: 18
  }
}
/**
 * Tool for creating a serialized transaction to send MON tokens
 */
export const getErc20TokensTool= {
  name: 'get_erc20_tokens',
  description: 'Get all erc20 tokens for an address, the information includes the token name, symbol, contract address, decimals and balance. Only Wrapped Monad(WMON) Moyaki(YAKI), Chog(CHOG) and Molandak(DAK) are supported. Note: MON is not ERC20 token, you should use evm_tool to get the balance of MON',
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


const TransferERC20ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_amount",
        "type": "uint256"
      }
    ],
    "name": "transferERC20",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

export const transferErc20TokenTool = {
  name: 'transfer_erc20_token',
  description: 'Transfer an erc20 token to an address',
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
          abi: TransferERC20ABI,
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