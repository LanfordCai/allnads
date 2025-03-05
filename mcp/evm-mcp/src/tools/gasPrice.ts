import { formatUnits } from 'ethers';
import { getProvider } from '../utils/ethers.js';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types.js';

interface GasPriceInfo {
  gasPrice: {
    wei: string;
    gwei: string;
  };
  eip1559?: {
    maxFeePerGas: {
      wei: string;
      gwei: string;
    };
    maxPriorityFeePerGas: {
      wei: string;
      gwei: string;
    };
  };
}

/**
 * Tool for fetching current gas prices on an EVM blockchain
 */
export const evmGasPriceTool = {
  name: 'evm_gas_price',
  description: 'Get current gas prices on an EVM blockchain',
  
  parameters: z.object({
    chain: z.string().default('ethereum').describe('The blockchain to check (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  }),
  
  execute: async (params: { chain?: string; customRpcUrl?: string }): Promise<ContentResult> => {
    try {
      const { chain = 'ethereum', customRpcUrl } = params;
      
      // Get provider for the specified chain
      const provider = getProvider(chain, customRpcUrl);
      
      // Get fee data which includes gas price
      const feeData = await provider.getFeeData();
      
      // Format gas price info
      const gasPriceInfo: GasPriceInfo = {
        gasPrice: {
          wei: feeData.gasPrice?.toString() || '0',
          gwei: feeData.gasPrice ? formatUnits(feeData.gasPrice, 'gwei') : '0',
        },
      };
      
      // Add EIP-1559 fee data if available
      if (feeData.maxFeePerGas) {
        gasPriceInfo.eip1559 = {
          maxFeePerGas: {
            wei: feeData.maxFeePerGas.toString(),
            gwei: formatUnits(feeData.maxFeePerGas, 'gwei'),
          },
          maxPriorityFeePerGas: {
            wei: feeData.maxPriorityFeePerGas?.toString() || '0',
            gwei: feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : '0',
          },
        };
      }
      
      return createTextResponse(`Gas Price Information for ${chain}:\n${JSON.stringify(gasPriceInfo, null, 2)}`);
    } catch (error) {
      return createTextResponse(`Error fetching gas price information: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
}; 