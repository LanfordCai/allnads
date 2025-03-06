import { formatEther } from 'ethers';
import { getProvider } from '../utils/ethers.js';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';

/**
 * Tool for fetching information about a transaction on an EVM blockchain
 */
export const evmTransactionInfoTool = {
  name: 'evm_transaction_info',
  description: 'Get information about a specific transaction on an EVM blockchain',
  
  parameters: z.object({
    txHash: z.string().describe('The transaction hash to fetch information for'),
    chain: z.string().default('ethereum').describe('The blockchain to check (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  }),
  
  execute: async (params: { txHash: string; chain?: string; customRpcUrl?: string }): Promise<ContentResult> => {
    try {
      const { txHash, chain = 'ethereum', customRpcUrl } = params;
      
      // Validate transaction hash format
      if (!txHash.match(/^0x[0-9a-fA-F]{64}$/)) {
        return createTextResponse(`Invalid transaction hash format: ${txHash}`);
      }
      
      // Get provider for the specified chain
      const provider = getProvider(chain, customRpcUrl);
      
      // Get transaction information
      const tx = await provider.getTransaction(txHash);
      
      if (!tx) {
        return createTextResponse(`Transaction not found: ${txHash} on chain ${chain}`);
      }
      
      // Get transaction receipt for additional information
      const receipt = await provider.getTransactionReceipt(txHash);
      
      // Format transaction info
      const txInfo = {
        hash: tx.hash,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        from: tx.from,
        to: tx.to,
        value: formatEther(tx.value) + ' ETH',
        gasPrice: tx.gasPrice?.toString() || 'N/A',
        maxFeePerGas: tx.maxFeePerGas?.toString() || 'N/A',
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString() || 'N/A',
        gasLimit: tx.gasLimit.toString(),
        nonce: tx.nonce,
        data: tx.data,
        status: receipt ? (receipt.status === 1 ? 'Success' : 'Failed') : 'Pending',
        gasUsed: receipt?.gasUsed?.toString() || 'N/A',
        effectiveGasPrice: receipt?.gasPrice?.toString() || 'N/A',
        cumulativeGasUsed: receipt?.cumulativeGasUsed?.toString() || 'N/A',
        logs: receipt?.logs?.length || 0,
      };
      
      return createTextResponse(`Transaction Information for ${txHash} on ${chain}:\n${JSON.stringify(txInfo, null, 2)}`);
    } catch (error) {
      return createTextResponse(`Error fetching transaction information: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 