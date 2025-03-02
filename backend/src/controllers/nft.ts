import { Request, Response } from 'express';
import { z } from 'zod';
import { blockchainService } from '../services/blockchainService';
import { Address, isAddress } from 'viem';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

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
      Logger.debug('NFTController', 'Processing check and airdrop NFT request');
      
      // 验证请求体
      const validationResult = airdropSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        Logger.warn('NFTController', 'Invalid request parameters for NFT airdrop', validationResult.error.format());
        return ResponseUtil.error(
          res,
          'Invalid request parameters',
          400,
          'VALIDATION_ERROR',
          validationResult.error.format()
        );
      }
      
      const { address, name } = validationResult.data;
      Logger.debug('NFTController', `Checking NFT for address: ${address}`);
      
      // 检查地址是否已经拥有NFT
      const hasNFT = await blockchainService.hasAllNadsNFT(address as Address);
      
      if (hasNFT) {
        Logger.info('NFTController', `Address ${address} already has an AllNads NFT`);
        return ResponseUtil.success(
          res,
          { hasNFT: true },
          'Address already has an AllNads NFT'
        );
      }
      
      Logger.info('NFTController', `Airdropping NFT to ${address} with name: ${name}`);
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
      
      Logger.info('NFTController', `Successfully airdropped NFT to ${address}, txHash: ${txHash}`);
      return ResponseUtil.success(
        res,
        {
          hasNFT: false,
          txHash,
          name
        },
        'AllNads NFT airdropped successfully'
      );
    } catch (error: any) {
      Logger.error('NFTController', 'Error in NFT airdrop', error);
      return ResponseUtil.error(
        res,
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR',
        { errorDetails: error.message }
      );
    }
  }
  
  /**
   * 检查地址是否拥有AllNads NFT
   */
  static async checkNFT(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      Logger.debug('NFTController', `Checking NFT ownership for address: ${address}`);
      
      if (!address || !isAddress(address)) {
        Logger.warn('NFTController', `Invalid address provided: ${address}`);
        return ResponseUtil.error(
          res,
          'Invalid address',
          400,
          'INVALID_ADDRESS'
        );
      }
      
      const hasNFT = await blockchainService.hasAllNadsNFT(address as Address);
      Logger.info('NFTController', `Address ${address} NFT check result: ${hasNFT ? 'Has NFT' : 'No NFT'}`);
      
      return ResponseUtil.success(
        res,
        {
          address,
          hasNFT
        }
      );
    } catch (error: any) {
      Logger.error('NFTController', `Error checking NFT for address ${req.params.address}`, error);
      return ResponseUtil.error(
        res,
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }
} 