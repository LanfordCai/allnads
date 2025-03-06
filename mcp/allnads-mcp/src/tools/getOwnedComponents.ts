import { type Address, isAddress, encodeFunctionData } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';
import { getPublicClient } from '../utils/viem.js';

const getAllOwnedTemplatesABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "getAllOwnedTemplates",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "ownedTemplateIds",
        "type": "uint256[]"
      },
      {
        "internalType": "enum AllNadsComponent.ComponentType[]",
        "name": "templateTypes",
        "type": "uint8[]"
      },
      {
        "internalType": "uint256[]",
        "name": "tokenIds",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]

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
export const getOwnedComponentsTool = {
  name: 'get_owned_components',
  description: 'Get the all the components owned by the Allnads NFT',
  parameters: z.object({
    allnadsAccount: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid allnads account address format',
        path: ['allnadsAccount']
      })
      .describe('The allnads account of the sender')
  }),
  
  execute: async (params: { allnadsAccount: string }): Promise<ContentResult> => {
    try {
      const { allnadsAccount } = params;
      return createTextResponse(`NOT IMPLEMENTED YET`);
    } catch (error) {
      return createTextResponse(`Error creating transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 