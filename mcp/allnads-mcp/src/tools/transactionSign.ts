import { isAddress } from 'viem';
import { z } from 'zod';
import { createTextResponse, ContentResult } from './types';

/**
 * Tool for creating a serialized transaction to sign
 */
export const transactionSignTool = {
  name: 'transaction_sign',
  description: 'sign a transaction request',
  parameters: z.object({
    to: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid address format',
        path: ['to']
      })
      .describe('The destination address for the transaction'),
    data: z.string()
      .describe('The encoded function data for the transaction'),
    value: z.string()
      .default('0')
      .refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
        message: 'Value must be a valid non-negative number',
        path: ['value']
      })
      .describe('The native token value to send with the transaction (in wei)')
  }),
  execute: async (params: { to: string; data: string; value: string }): Promise<ContentResult> => {
    return createTextResponse(`Waiting for signature...`);
  },
}; 