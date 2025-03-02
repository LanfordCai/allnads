import { Request, Response } from 'express';
import { z } from 'zod';
import { blockchainService } from '../services/blockchainService';
import { Address, isAddress } from 'viem';

// 简化的验证模式，只需要地址和可选的名称
const airdropSchema = z.object({
  address: z.string().refine(val => isAddress(val), {
    message: 'Invalid address'
  }),
  name: z.string().min(1).max(50).optional().default('AllNads Avatar')
});

/**
 * NFT控制器，处理NFT相关请求
 */
export class NFTController {
  /**
   * 检查地址是否有AllNads NFT并在没有时空投一个
   */
  static async checkAndAirdropNFT(req: Request, res: Response): Promise<void> {
    try {
      // 验证请求体
      const validationResult = airdropSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid request parameters',
          errors: validationResult.error.format()
        });
        return;
      }
      
      const { address, name } = validationResult.data;
      
      // 检查地址是否已经拥有NFT
      const hasNFT = await blockchainService.hasAllNadsNFT(address as Address);
      
      if (hasNFT) {
        res.status(200).json({
          success: true,
          message: 'Address already has an AllNads NFT',
          data: {
            hasNFT: true
          }
        });
        return;
      }
      
      // 使用默认组件空投NFT
      const defaultTemplates = blockchainService.getDefaultTemplateIds();
      const txHash = await blockchainService.airdropNFT(
        address as Address,
        name,
        defaultTemplates.backgroundTemplateId,
        defaultTemplates.hairstyleTemplateId,
        defaultTemplates.eyesTemplateId,
        defaultTemplates.mouthTemplateId,
        defaultTemplates.accessoryTemplateId
      );
      
      res.status(200).json({
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
      res.status(500).json({
        success: false,
        message: `Internal server error: ${error.message}`,
        error: error.message
      });
    }
  }
  
  /**
   * 检查地址是否拥有AllNads NFT
   */
  static async checkNFT(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      
      if (!address || !isAddress(address)) {
        res.status(400).json({
          success: false,
          message: 'Invalid address'
        });
        return;
      }
      
      const hasNFT = await blockchainService.hasAllNadsNFT(address as Address);
      
      res.status(200).json({
        success: true,
        data: {
          address,
          hasNFT
        }
      });
    } catch (error: any) {
      console.error(`Error checking NFT for address ${req.params.address}:`, error);
      res.status(500).json({
        success: false,
        message: `Internal server error: ${error.message}`,
        error: error.message
      });
    }
  }
} 