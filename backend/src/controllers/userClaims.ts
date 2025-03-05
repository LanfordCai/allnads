import { Request, Response } from 'express';
import { z } from 'zod';
import { formatEther, isAddress, parseEther } from 'viem';
import { db } from '../config/database';
import { userClaims } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';
import { blockchainService } from '../services/blockchainService';

// MON代币领取验证模式
const monClaimSchema = z.object({
  address: z.string().refine(val => isAddress(val), {
    message: 'Invalid Ethereum address'
  })
});

/**
 * 用户奖励领取控制器，处理用户MON代币和NFT领取相关的请求
 */
export class UserClaimsController {
  /**
   * 获取用户的奖励领取状态
   */
  static async getClaimStatus(req: Request & { user?: any }, res: Response) {
    try {
      Logger.debug('UserClaimsController', 'Getting claim status for user');
      
      if (!req.user || !req.user.id) {
        Logger.warn('UserClaimsController', 'User not authenticated when accessing claim status');
        return ResponseUtil.error(
          res, 
          'User not authenticated',
          401,
          'AUTH_REQUIRED'
        );
      }

      const privyUserId = req.user.id;
      Logger.debug('UserClaimsController', `Fetching claim status for user: ${privyUserId}`);
      
      // 获取用户的所有领取记录
      const claims = await db.select().from(userClaims).where(eq(userClaims.privyUserId, privyUserId));
      
      Logger.info('UserClaimsController', `Successfully retrieved claim status for user: ${privyUserId}`);
      return ResponseUtil.success(res, { claims });
    } catch (error: any) {
      Logger.error('UserClaimsController', 'Error getting claim status', error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * 领取MON代币
   */
  static async claimMON(req: Request & { user?: any }, res: Response) {
    try {
      Logger.debug('UserClaimsController', 'Processing MON token claim request');
      
      if (!req.user || !req.user.id) {
        Logger.warn('UserClaimsController', 'User not authenticated when claiming MON');
        return ResponseUtil.error(
          res, 
          'User not authenticated',
          401,
          'AUTH_REQUIRED'
        );
      }

      // 验证请求体
      const validationResult = monClaimSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        Logger.warn('UserClaimsController', 'Invalid request parameters for MON claim', validationResult.error.format());
        return ResponseUtil.error(
          res,
          'Invalid request parameters',
          400,
          'VALIDATION_ERROR',
          validationResult.error.format()
        );
      }
      
      const { address } = validationResult.data;
      const privyUserId = req.user.id;
      
      // 检查用户是否已经领取过MON代币（不限制特定地址，每个用户只能领取一次）
      const existingClaim = await db.select().from(userClaims).where(
        and(
          eq(userClaims.privyUserId, privyUserId),
          eq(userClaims.hasClaimedMON, true)
        )
      );
      
      if (existingClaim.length > 0) {
        Logger.warn('UserClaimsController', `User ${privyUserId} has already claimed MON tokens`);
        return ResponseUtil.error(
          res,
          'You have already claimed MON tokens. Each user can only claim once.',
          400,
          'ALREADY_CLAIMED'
        );
      }
      
      try {
        // 执行MON代币的领取操作（作为原生货币发送）
        const claimAmount = parseEther('1'); // 1 MON (假设MON有18位小数)
        const txHash = await blockchainService.sendMon(address, claimAmount.toString());
        
        // 交易已确认成功，现在更新数据库
        // 更新或创建用户的领取记录
        const now = new Date();
        let userClaimRecord = await db.select().from(userClaims).where(
          and(
            eq(userClaims.privyUserId, privyUserId),
            eq(userClaims.address, address)
          )
        );
        
        if (userClaimRecord.length === 0) {
          // 创建新记录
          await db.insert(userClaims).values({
            privyUserId,
            address,
            hasClaimedMON: true,
            monClaimTxId: txHash,
            monClaimDate: now,
            monClaimAmount: claimAmount.toString(),
            createdAt: now,
            updatedAt: now
          });
        } else {
          // 更新现有记录
          await db.update(userClaims)
            .set({
              hasClaimedMON: true,
              monClaimTxId: txHash,
              monClaimDate: now,
              monClaimAmount: claimAmount.toString(),
              updatedAt: now
            })
            .where(
              and(
                eq(userClaims.privyUserId, privyUserId),
                eq(userClaims.address, address)
              )
            );
        }
        
        Logger.info('UserClaimsController', `Successfully claimed MON tokens for user ${privyUserId}, address ${address}, txHash: ${txHash}`);
        return ResponseUtil.success(
          res,
          {
            txHash,
            amount: claimAmount,
            address
          },
          'MON tokens claimed successfully'
        );
      } catch (txError: any) {
        Logger.error('UserClaimsController', `Transaction failed when claiming MON tokens for ${address}`, txError);
        return ResponseUtil.error(
          res,
          `Failed to claim MON tokens: ${txError.message}`,
          500,
          'TRANSACTION_FAILED'
        );
      }
    } catch (error: any) {
      Logger.error('UserClaimsController', 'Error claiming MON tokens', error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * 更新NFT领取状态（通常由系统内部调用，例如在NFT空投后）
   */
  static async updateNFTClaimStatus(privyUserId: string, address: string, txHash: string) {
    try {
      Logger.debug('UserClaimsController', `Updating NFT claim status for user ${privyUserId}, address ${address}`);
      
      const now = new Date();
      let userClaimRecord = await db.select().from(userClaims).where(
        and(
          eq(userClaims.privyUserId, privyUserId),
          eq(userClaims.address, address)
        )
      );
      
      if (userClaimRecord.length === 0) {
        // 创建新记录
        await db.insert(userClaims).values({
          privyUserId,
          address,
          hasClaimedNFT: true,
          nftClaimTxId: txHash,
          nftClaimDate: now,
          createdAt: now,
          updatedAt: now
        });
      } else {
        // 更新现有记录
        await db.update(userClaims)
          .set({
            hasClaimedNFT: true,
            nftClaimTxId: txHash,
            nftClaimDate: now,
            updatedAt: now
          })
          .where(
            and(
              eq(userClaims.privyUserId, privyUserId),
              eq(userClaims.address, address)
            )
          );
      }
      
      Logger.info('UserClaimsController', `Successfully updated NFT claim status for user ${privyUserId}, address ${address}`);
      return true;
    } catch (error: any) {
      Logger.error('UserClaimsController', `Error updating NFT claim status for user ${privyUserId}`, error);
      throw error;
    }
  }
} 