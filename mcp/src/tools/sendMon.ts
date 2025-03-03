import { type Address, parseEther, isAddress, encodeFunctionData } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';
import { getPublicClient } from '../utils/viem.js';

const SendABI = [
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "send",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
/**
 * Tool for creating a serialized transaction to send MON tokens
 */
export const sendMonTool = {
  name: 'send_mon',
  description: 'Create a transaction request to send MON to a specific address from an allnads account',
  parameters: z.object({
    allnadsAccount: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid allnads account address format',
        path: ['allnadsAccount']
      })
      .describe('The allnads account of the sender'),
    address: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid address format',
        path: ['address']
      })
      .describe('The address to send MON to'),
    amount: z.string()
      .refine(amt => !isNaN(Number(amt)) && Number(amt) > 0, {
        message: 'Amount must be a valid positive number',
        path: ['amount']
      })
      .describe('The amount of MON to send')
  }),
  
  execute: async (params: { allnadsAccount: string; address: string; amount: string }): Promise<ContentResult> => {
    try {
      const { allnadsAccount, address, amount } = params;

      const publicClient = getPublicClient();

      // Check MON balance
      const balance = await publicClient.getBalance({
        address: allnadsAccount as Address,
      }) as bigint;

      const amountInWei = parseEther(amount);
      if (balance < amountInWei) {
        return createTextResponse(`Insufficient MON balance. Available: ${balance}, Required: ${amountInWei}`);
      }
      
      // Encode the function call data for the 'send' method
      const data = encodeFunctionData({
        abi: SendABI,
        functionName: 'send',
        args: [address, parseEther(amount)]
      });

      // Create the transaction request
      const transactionRequest = {
        to: allnadsAccount, // The AllNads account address
        data: data,
        value: '0' // No native token value needed since we're calling a contract method
      };

      return createTextResponse(`Get transaction request: \n${JSON.stringify(transactionRequest, null, 2)}`);
    } catch (error) {
      return createTextResponse(`Error creating transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 