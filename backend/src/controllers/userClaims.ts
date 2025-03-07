import { Request, Response } from 'express';
import { db } from '../config/database';
import { userClaims } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';
import { blockchainService } from '../services/blockchainService';

/**
 * 用户奖励领取控制器，处理用户NFT领取相关的请求
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