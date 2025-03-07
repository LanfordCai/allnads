import { Request, Response } from 'express';
import { z } from 'zod';
import { blockchainService, COMPONENT_TYPES } from '../services/blockchainService';
import { Address, isAddress } from 'viem';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';
import { serializeTemplates } from '../utils/serialization';
import { UserClaimsController } from './userClaims';
import { db } from '../config/database';
import { userClaims } from '../models/schema';
import { eq, and } from 'drizzle-orm';

// 简化的验证模式，只需要地址和可选的名称
const airdropSchema = z.object({
  address: z.string().refine(val => isAddress(val), {
    message: 'Invalid address'
  }),
  name: z.string().min(1).max(50).optional().default('AllNads Avatar')
});

// Template request validation schema
const templateRequestSchema = z.object({
  componentType: z.number().int().min(0).max(4).optional(),
  address: z.string().refine(val => isAddress(val), {
    message: 'Invalid address'
  }).optional()
});

/**
 * NFT控制器，处理NFT相关请求
 */
export class NFTController {
  /**
   * 检查地址是否有AllNads NFT并在没有时空投一个
   */
  static async checkAndAirdropNFT(req: Request & { user?: any }, res: Response): Promise<void> {
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
      
      // 如果用户已登录，检查是否已经领取过NFT
      if (req.user && req.user.id) {
        const privyUserId = req.user.id;
        const existingClaim = await db.select().from(userClaims).where(
          and(
            eq(userClaims.privyUserId, privyUserId),
            eq(userClaims.hasClaimedNFT, true)
          )
        );
        
        if (existingClaim.length > 0) {
          Logger.warn('NFTController', `User ${privyUserId} has already claimed an NFT`);
          return ResponseUtil.error(
            res,
            'You have already claimed an NFT. Each user can only claim one NFT.',
            400,
            'ALREADY_CLAIMED'
          );
        }
      }
      
      Logger.info('NFTController', `Airdropping NFT to ${address} with name: ${name}`);
      
      try {
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
        
        // airdropNFT 方法内部已经等待交易确认并检查了交易状态
        // 交易已确认成功，现在更新数据库
        // 如果用户已登录，更新其NFT领取状态
        if (req.user && req.user.id) {
          try {
            await UserClaimsController.updateNFTClaimStatus(req.user.id, address, txHash);
            Logger.info('NFTController', `Successfully updated NFT claim status for user ${req.user.id}`);
          } catch (updateError) {
            Logger.error('NFTController', `Error updating NFT claim status for user ${req.user.id}`, updateError);
            // 不中断主流程，继续返回成功
          }
        }
        
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
      } catch (txError: any) {
        Logger.error('NFTController', `Transaction failed when airdropping NFT to ${address}`, txError);
        return ResponseUtil.error(
          res,
          `Failed to airdrop NFT: ${txError.message}`,
          500,
          'TRANSACTION_FAILED'
        );
      }
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
  
  /**
   * 获取所有模板信息
   */
  static async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      Logger.debug('NFTController', 'Processing get all templates request');
      
      // 获取所有模板（使用缓存）
      const templates = await blockchainService.getAllTemplates();
      
      // Serialize templates for JSON response
      const serializedTemplates = serializeTemplates(templates);
      
      Logger.info('NFTController', 'Successfully retrieved all templates');
      return ResponseUtil.success(
        res,
        { templates: serializedTemplates },
        'Templates retrieved successfully'
      );
    } catch (error: any) {
      Logger.error('NFTController', 'Error getting all templates', error);
      return ResponseUtil.error(
        res,
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR',
        { errorDetails: error.message }
      );
    }
  }
} 