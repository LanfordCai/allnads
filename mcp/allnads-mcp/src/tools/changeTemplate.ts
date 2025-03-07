import { type Address, isAddress, encodeFunctionData } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types';
import { getPublicClient } from '../utils/viem';

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

const GetAddressTemplateTokenABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_owner",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_templateId",
        "type": "uint256"
      }
    ],
    "name": "getAddressTemplateToken",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]

const ChangeComponentABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "componentId",
        "type": "uint256"
      },
      {
        "internalType": "enum AllNadsComponent.ComponentType",
        "name": "componentType",
        "type": "uint8"
      }
    ],
    "name": "changeComponent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

const GetApprovedABI = [
  {
    name: "getApproved",
    type: "function",
    inputs: [
      { name: "tokenId", type: "uint256" }
    ],
    outputs: [
      { name: "", type: "address" }
    ],
    stateMutability: "view"
  }
];

const ApproveABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
];

const COMPONENT_TYPES = {
  BACKGROUND: 0,
  HAIRSTYLE: 1,
  EYES: 2,
  MOUTH: 3,
  ACCESSORY: 4,
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4
};
/**
 * Tool for creating a serialized transaction to send MON tokens
 */
export const changeTemplateTool = {
  name: 'change_template',
  description: 'Change the template of the Allnads NFT only if the Allnads NFT already owns a component in the template.',
  parameters: z.object({
    allnadsAccount: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid allnads account address format',
        path: ['allnadsAccount']
      })
      .describe('The allnads account of the sender'),
    tokenId: z.number()
      .describe('The token id of the Allnads NFT'),
    templateId: z.number()
      .describe('The template id to change to'),
    componentType: z.string()
      .describe('The component type of the template'),
  }),
  
  execute: async (params: { allnadsAccount: string; tokenId: number; templateId: number; componentType: string }): Promise<ContentResult> => {
    try {
      const { allnadsAccount, tokenId, templateId, componentType } = params;

      const publicClient = getPublicClient();

      let componentId: bigint;
      try {
        componentId = await publicClient.readContract({
          address: process.env.MONAD_TESTNET_ALLNADS_COMPONENT_CONTRACT_ADDRESS as Address,
          abi: GetAddressTemplateTokenABI,
          functionName: 'getAddressTemplateToken',
          args: [allnadsAccount, templateId]
        }) as bigint;
      } catch (error) {
        return createTextResponse(`The Allnads NFT does not own a component in the template. Please re-check the template id and component type.`);
      }

      const componentTypeNumber = COMPONENT_TYPES[componentType.toUpperCase() as keyof typeof COMPONENT_TYPES];
      console.log(`allnadsAccount: ${allnadsAccount}`);
      console.log(`tokenId: ${tokenId}`);
      console.log(`templateId: ${templateId}`);
      console.log(`componentId: ${componentId}`);
      console.log(`componentTypeNumber: ${componentTypeNumber}`);

      const approved = await publicClient.readContract({
        address: process.env.MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as Address,
        abi: GetApprovedABI,
        functionName: 'getApproved',
        args: [tokenId]
      });

      if (approved !== allnadsAccount) {
        const approveData = encodeFunctionData({
          abi: ApproveABI,
          functionName: 'approve',
          args: [allnadsAccount, tokenId]
        });

        const transactionRequest = {
          to: process.env.MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as Address,
          data: approveData,
          value: '0' // No native token value needed since we're calling a contract method
        };

        return createTextResponse(`This Allnads NFT with token id ${tokenId} is not approved to be changed by the AllNads Account ${allnadsAccount}. Please approve the Allnads NFT to be changed by the AllNads Account, so we can change the template later.\n[Transaction Request]\n${JSON.stringify(transactionRequest, null, 2)}`);
      }


      // Encode the function call data for the 'send' method
      const allNadsCallData = encodeFunctionData({
        abi: ChangeComponentABI,
        functionName: 'changeComponent',
        args: [tokenId, componentId, componentTypeNumber]
      });

      const data = encodeFunctionData({
        abi: ExecuteCallABI,
        functionName: 'executeCall',
        args: [process.env.MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as Address, '0', allNadsCallData]
      });

      // Create the transaction request
      const transactionRequest = {
        to: allnadsAccount, // The AllNads account address
        data: data,
        value: '0' // No native token value needed since we're calling a contract method
      };

      return createTextResponse(`<<TransactionRequest>>\n${JSON.stringify(transactionRequest, null, 2)}`);
    } catch (error) {
      return createTextResponse(`Error creating transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 