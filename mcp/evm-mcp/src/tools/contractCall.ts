import { Interface, formatUnits } from 'ethers';
import { getProvider } from '../utils/ethers.js';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';

/**
 * Tool for making read-only calls to EVM smart contracts
 */
export const evmContractCallTool = {
  name: 'evm_contract_call',
  description: 'Make a read-only call to a smart contract on an EVM blockchain',
  
  parameters: z.object({
    contractAddress: z.string().describe('The address of the smart contract'),
    abi: z.string().describe('The ABI of the function to call (can be a full contract ABI or just the function ABI)'),
    functionName: z.string().describe('The name of the function to call'),
    args: z.array(z.string()).optional().describe('The arguments to pass to the function'),
    chain: z.string().default('ethereum').describe('The blockchain to use (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  }),
  
  execute: async (params: { 
    contractAddress: string; 
    abi: string; 
    functionName: string; 
    args?: string[]; 
    chain?: string; 
    customRpcUrl?: string 
  }): Promise<ContentResult> => {
    try {
      const { 
        contractAddress, 
        abi, 
        functionName, 
        args = [], 
        chain = 'ethereum', 
        customRpcUrl 
      } = params;
      
      // Validate address format
      if (!contractAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
        return createTextResponse(`Invalid Ethereum contract address format: ${contractAddress}`);
      }
      
      // Get provider for the specified chain
      const provider = getProvider(chain, customRpcUrl);
      
      // Parse the ABI
      let iface: Interface;
      try {
        iface = new Interface(abi);
      } catch (error) {
        return createTextResponse(`Invalid ABI format: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Check if the function exists
      if (!iface.hasFunction(functionName)) {
        return createTextResponse(`Function ${functionName} not found in the provided ABI`);
      }
      
      // Get function fragment to determine parameter types
      const fragment = iface.getFunction(functionName);
      
      // Process arguments based on parameter types
      const processedArgs = args.map((arg, index) => {
        const paramType = fragment?.inputs?.[index]?.type;
        if (!paramType) {
          return arg;
        }
        
        // Handle specific types
        if (paramType.includes('int') && !arg.startsWith('0x')) {
          return arg; // ethers.js will handle the conversion
        }
        
        return arg;
      });
      
      // Make the contract call
      const data = iface.encodeFunctionData(functionName, processedArgs);
      const result = await provider.call({
        to: contractAddress,
        data,
      });
      
      // Decode the result
      const decodedResult = iface.decodeFunctionResult(functionName, result);
      
      // Format the result for better readability
      let formattedResult: any;
      
      if (Array.isArray(decodedResult)) {
        formattedResult = decodedResult.map(item => {
          if (typeof item === 'bigint') {
            return item.toString();
          }
          return item;
        });
      } else if (decodedResult && typeof decodedResult === 'object') {
        // Handle Result object
        formattedResult = Object.fromEntries(
          Object.entries(decodedResult).map(([key, value]) => {
            if (typeof value === 'bigint') {
              return [key, value.toString()];
            }
            return [key, value];
          })
        );
      } else {
        // Fallback for any other type
        formattedResult = String(decodedResult);
      }
      
      return createTextResponse(`Contract call result for ${functionName} at ${contractAddress} on ${chain}:\n${JSON.stringify(formattedResult, null, 2)}`);
    } catch (error) {
      return createTextResponse(`Error calling contract: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 