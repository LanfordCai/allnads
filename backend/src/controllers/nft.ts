import { Request, Response } from 'express';
import { z } from 'zod';
import { blockchainService } from '../services/blockchainService';
import { Address } from 'viem';

// Validation schema for the airdrop request
const airdropSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  name: z.string().min(1).max(50).optional().default('AllNads Avatar'),
  // Optional component IDs will use defaults if not provided
  backgroundId: z.string().optional().transform((val) => val ? BigInt(val) : undefined),
  hairstyleId: z.string().optional().transform((val) => val ? BigInt(val) : undefined),
  eyesId: z.string().optional().transform((val) => val ? BigInt(val) : undefined),
  mouthId: z.string().optional().transform((val) => val ? BigInt(val) : undefined),
  accessoryId: z.string().optional().transform((val) => val ? BigInt(val) : undefined),
});

/**
 * NFT controller, handles NFT-related requests
 */
export class NFTController {
  /**
   * Check if an address has an AllNads NFT and airdrop one if not
   */
  static async checkAndAirdropNFT(req: Request, res: Response) {
    try {
      // Validate the request body
      const validationResult = airdropSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request parameters',
          errors: validationResult.error.format()
        });
      }
      
      const { address, name, backgroundId, hairstyleId, eyesId, mouthId, accessoryId } = validationResult.data;
      
      // Check if the address already has an NFT
      const hasNFT = await blockchainService.hasAllNadsNFT(address as Address);
      
      if (hasNFT) {
        return res.status(200).json({
          success: true,
          message: 'Address already has an AllNads NFT',
          data: {
            hasNFT: true
          }
        });
      }
      
      // Get default component IDs if not provided
      const defaultComponents = blockchainService.getDefaultComponentIds();
      
      // Airdrop the NFT
      const txHash = await blockchainService.airdropNFT(
        address as Address,
        name,
        backgroundId || defaultComponents.backgroundId,
        hairstyleId || defaultComponents.hairstyleId,
        eyesId || defaultComponents.eyesId,
        mouthId || defaultComponents.mouthId,
        accessoryId || defaultComponents.accessoryId
      );
      
      return res.status(200).json({
        success: true,
        message: 'AllNads NFT airdropped successfully',
        data: {
          hasNFT: false,
          txHash,
          name
        }
      });
    } catch (error: any) {
      console.error('Error in NFT airdrop:', error);
      return res.status(500).json({
        success: false,
        message: `Internal server error: ${error.message}`,
        error: error.message
      });
    }
  }
  
  /**
   * Check if an address has an AllNads NFT
   */
  static async checkNFT(req: Request, res: Response) {
    try {
      const { address } = req.params;
      
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Ethereum address'
        });
      }
      
      const hasNFT = await blockchainService.hasAllNadsNFT(address as Address);
      
      return res.status(200).json({
        success: true,
        data: {
          address,
          hasNFT
        }
      });
    } catch (error: any) {
      console.error(`Error checking NFT for address ${req.params.address}:`, error);
      return res.status(500).json({
        success: false,
        message: `Internal server error: ${error.message}`,
        error: error.message
      });
    }
  }
} 