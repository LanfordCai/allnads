import { type Address, isAddress, encodeFunctionData } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';
import { getPublicClient } from '../utils/viem.js';
import { templateCache } from '../utils/globalCache.js';
import { env } from '../config/env.js';

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

// Map component type numbers to their string representation
const COMPONENT_TYPE_NAMES: Record<number, string> = {
  0: 'BACKGROUND',
  1: 'HAIRSTYLE',
  2: 'EYES',
  3: 'MOUTH',
  4: 'ACCESSORY'
};

/**
 * Tool for getting components owned by an Allnads NFT
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
      
      // Get the public client for interacting with the blockchain
      const publicClient = getPublicClient();
      
      // Get the component contract address from environment variables
      const componentQueryContractAddress = env.MONAD_TESTNET_ALLNADS_COMPONENT_QUERY_CONTRACT_ADDRESS as Address;
      
      // Call the contract to get owned templates
      const result = await publicClient.readContract({
        address: componentQueryContractAddress,
        abi: getAllOwnedTemplatesABI,
        functionName: 'getAllOwnedTemplates',
        args: [allnadsAccount as Address]
      });
      
      // Extract the results
      const [ownedTemplateIds, templateTypes, tokenIds] = result as [bigint[], number[], bigint[]];
      
      // Process the results into a structured format
      const ownedComponents = [];
      
      for (let i = 0; i < ownedTemplateIds.length; i++) {
        const templateId = ownedTemplateIds[i];
        const templateType = templateTypes[i];
        const tokenId = tokenIds[i];
        
        // Get template details from the global cache
        const template = await templateCache.getTemplateById(templateId);
        
        ownedComponents.push({
          templateId: templateId.toString(),
          tokenId: tokenId.toString(),
          componentType: COMPONENT_TYPE_NAMES[templateType] || `UNKNOWN(${templateType})`,
          name: template?.name || `Unknown Template (ID: ${templateId})`
        });
      }
      
      // Group components by type
      const groupedComponents: Record<string, any[]> = {};
      
      for (const component of ownedComponents) {
        if (!groupedComponents[component.componentType]) {
          groupedComponents[component.componentType] = [];
        }
        groupedComponents[component.componentType].push(component);
      }
      
      // Format the response
      const responseText = JSON.stringify({
        success: true,
        data: {
          allnadsAccount,
          ownedComponents: groupedComponents
        }
      }, null, 2);
      
      return createTextResponse(responseText);
    } catch (error) {
      return createTextResponse(`Error getting owned components: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 