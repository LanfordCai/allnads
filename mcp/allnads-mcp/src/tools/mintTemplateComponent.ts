import { type Address, isAddress, encodeFunctionData, parseEther, formatEther } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';
import { getPublicClient } from '../utils/viem.js';

const ExecuteCallABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "executeCall",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "result",
        "type": "bytes"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
]

const MintComponentABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_templateId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_to",
        "type": "address"
      }
    ],
    "name": "mintComponent",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
]

const GetTemplateABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_templateId",
        "type": "uint256"
      }
    ],
    "name": "getTemplate",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "creator",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "maxSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "currentSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "price",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "imageData",
            "type": "string"
          },
          {
            "internalType": "bool",
            "name": "isActive",
            "type": "bool"
          },
          {
            "internalType": "enum AllNadsComponent.ComponentType",
            "name": "componentType",
            "type": "uint8"
          }
        ],
        "internalType": "struct AllNadsComponent.Template",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
]

/**
 * Tool for creating a serialized transaction to send MON tokens
 */
export const mintTemplateComponentTool = {
  name: 'mint_template_component',
  description: 'Mint a component for the template for the given allnads account',
  parameters: z.object({
    allnadsAccount: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid allnads account address format',
        path: ['allnadsAccount']
      })
      .describe('The allnads account of the sender'),
    templateId: z.number()
      .describe('The template id of the component to mint')
  }),
  
  execute: async (params: { allnadsAccount: string; templateId: number }): Promise<ContentResult> => {
    try {
      const { allnadsAccount, templateId } = params;

      const publicClient = getPublicClient();

      const template = await publicClient.readContract({
        address: process.env.MONAD_TESTNET_ALLNADS_COMPONENT_CONTRACT_ADDRESS as Address,
        abi: GetTemplateABI,
        functionName: 'getTemplate',
        args: [templateId]
      }) as { price: bigint };

      if (!template) {
        return createTextResponse(`Template with id ${templateId} not found, please check the template id and try again.`);
      }

      // Encode the function call data for the 'send' method
      const allNadsCallData = encodeFunctionData({
        abi: MintComponentABI,
        functionName: 'mintComponent',
        args: [templateId, allnadsAccount],
      });

      const data = encodeFunctionData({
        abi: ExecuteCallABI,
        functionName: 'executeCall',
        args: [process.env.MONAD_TESTNET_ALLNADS_COMPONENT_CONTRACT_ADDRESS as Address, template.price, allNadsCallData]
      });

      // Create the transaction request
      const transactionRequest = {
        to: allnadsAccount, // The AllNads account address
        data: data,
        value: '0'
      };

      return createTextResponse(`[Transaction Request]\n${JSON.stringify(transactionRequest, null, 2)}`);
    } catch (error) {
      return createTextResponse(`Error creating transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 