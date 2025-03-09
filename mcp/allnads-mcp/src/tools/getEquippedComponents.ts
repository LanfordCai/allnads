import { type Address, isAddress } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';
import { getPublicClient } from '../utils/viem.js';
import { templateCache } from '../utils/globalCache.js';
import { env } from '../config/env.js';
import { AllNadsABI } from '../abis/AllNads.js';

// Map component type numbers to their string representation
const COMPONENT_TYPE_NAMES: Record<number, string> = {
  0: 'BACKGROUND',
  1: 'HAIRSTYLE',
  2: 'EYES',
  3: 'MOUTH',
  4: 'ACCESSORY'
};

/**
 * Tool for getting components currently equipped on an Allnads NFT
 */
export const getEquippedComponentsTool = {
  name: 'get_equipped_components',
  description: 'Get the components currently equipped on an Allnads NFT',
  parameters: z.object({
    tokenId: z.string()
      .or(z.number())
      .transform(val => typeof val === 'string' ? parseInt(val, 10) : val)
      .refine(val => !isNaN(val) && val >= 0, {
        message: 'Invalid token ID format',
        path: ['tokenId']
      })
      .describe('The token ID of the Allnads NFT')
  }),
  
  execute: async (params: { tokenId: number }): Promise<ContentResult> => {
    try {
      const { tokenId } = params;
      
      // Get the public client for interacting with the blockchain
      const publicClient = getPublicClient();
      
      // Get the Allnads contract address from environment variables
      const allnadsContractAddress = env.MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as Address;
      
      // Call the contract to get avatar details
      const avatarData = await publicClient.readContract({
        address: allnadsContractAddress,
        abi: AllNadsABI,
        functionName: 'getAvatar',
        args: [BigInt(tokenId)]
      });
      
      // Extract the component IDs from the avatar data
      // The avatar data structure matches the Avatar struct in the contract
      const { 
        name, 
        backgroundId, 
        hairstyleId, 
        eyesId, 
        mouthId, 
        accessoryId 
      } = avatarData as { 
        name: string, 
        backgroundId: bigint, 
        hairstyleId: bigint, 
        eyesId: bigint, 
        mouthId: bigint, 
        accessoryId: bigint 
      };
      
      // Create an array of component IDs and their types
      const componentData = [
        { id: backgroundId, type: 0 },
        { id: hairstyleId, type: 1 },
        { id: eyesId, type: 2 },
        { id: mouthId, type: 3 },
        { id: accessoryId, type: 4 }
      ];
      
      // Process the results into a structured format
      const EquippedComponents = [];
      
      for (const component of componentData) {
        // Get template details from the global cache
        const template = await templateCache.getTemplateById(component.id);
        
        EquippedComponents.push({
          templateId: component.id.toString(),
          componentType: COMPONENT_TYPE_NAMES[component.type] || `UNKNOWN(${component.type})`,
          name: template?.name || `Unknown Template (ID: ${component.id})`
        });
      }
      
      // Group components by type
      const groupedComponents: Record<string, any[]> = {};
      
      for (const component of EquippedComponents) {
        if (!groupedComponents[component.componentType]) {
          groupedComponents[component.componentType] = [];
        }
        groupedComponents[component.componentType].push(component);
      }
      
      // Format the response
      const responseText = JSON.stringify({
        success: true,
        data: {
          tokenId,
          avatarName: name,
          EquippedComponents: groupedComponents
        }
      }, null, 2);
      
      return createTextResponse(responseText);
    } catch (error) {
      return createTextResponse(`Error getting equipped components: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
