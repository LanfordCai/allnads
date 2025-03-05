import { getProvider } from '../utils/ethers.js';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';

/**
 * Tool for fetching information about a block on an EVM blockchain
 */
export const evmBlockInfoTool = {
  name: 'evm_block_info',
  description: 'Get information about a specific block or the latest block on an EVM blockchain',
  
  parameters: z.object({
    blockNumber: z.string().default('latest').describe('The block number to fetch information for, or "latest" for the latest block'),
    chain: z.string().default('ethereum').describe('The blockchain to check (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  }),
  
  execute: async (params: { blockNumber?: string; chain?: string; customRpcUrl?: string }): Promise<ContentResult> => {
    try {
      const { blockNumber = 'latest', chain = 'ethereum', customRpcUrl } = params;
      
      // Get provider for the specified chain
      const provider = getProvider(chain, customRpcUrl);
      
      // Get block information
      const block = await provider.getBlock(blockNumber === 'latest' ? 'latest' : parseInt(blockNumber, 10));
      
      if (!block) {
        return createTextResponse(`Block not found: ${blockNumber} on chain ${chain}`);
      }
      
      // Format block info
      const blockInfo = {
        number: block.number,
        hash: block.hash,
        timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
        parentHash: block.parentHash,
        miner: block.miner,
        gasLimit: block.gasLimit.toString(),
        gasUsed: block.gasUsed.toString(),
        baseFeePerGas: block.baseFeePerGas?.toString() || 'N/A',
        transactions: block.transactions.length,
      };
      
      return createTextResponse(`Block Information for ${blockNumber === 'latest' ? 'latest' : blockNumber} on ${chain}:\n${JSON.stringify(blockInfo, null, 2)}`);
    } catch (error) {
      return createTextResponse(`Error fetching block information: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 