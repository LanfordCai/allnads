import { Request, Response } from 'express';
import { z } from 'zod';
import { isAddress } from 'viem';
import { db } from '../config/database';
import { addressBook } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

// 地址簿条目验证模式
const addressBookEntrySchema = z.object({
  name: z.string().min(1).max(50),
  address: z.string().refine(val => isAddress(val), {
    message: 'Invalid Ethereum address'
  }),
  description: z.string().max(200).optional()
});

/**
 * 地址簿控制器，处理用户地址簿相关的请求
 */
export class AddressBookController {
  /**
   * 验证用户访问权限
   */
  private static validateUserAccess(req: Request & { user?: any; isService?: boolean }, res: Response): boolean {
    const { userId: rawUserId } = req.params;
    const userId = decodeURIComponent(rawUserId);
    
    // Allow service requests to bypass user check
    if (req.isService) {
      return true;
    }

    if (!req.user || !req.user.id) {
      Logger.warn('AddressBookController', 'User not authenticated');
      ResponseUtil.error(res, 'User not authenticated', 401, 'AUTH_REQUIRED');
      return false;
    }

    if (userId !== req.user.id) {
      Logger.warn('AddressBookController', `User ${req.user.id} attempted to access address book of user ${userId}`);
      ResponseUtil.error(res, 'Unauthorized access', 403, 'FORBIDDEN');
      return false;
    }

    return true;
  }

  /**
   * 获取用户的地址簿
   */
  static async getAddressBook(req: Request & { user?: any }, res: Response) {
    try {
      Logger.debug('AddressBookController', 'Getting address book for user');
      
      if (!AddressBookController.validateUserAccess(req, res)) return;

      const { userId: rawUserId } = req.params;
      const userId = decodeURIComponent(rawUserId);

      Logger.debug('AddressBookController', `Fetching address book for user: ${userId}`);
      
      const addresses = await db.select().from(addressBook).where(eq(addressBook.privyUserId, userId));
      
      Logger.info('AddressBookController', `Successfully retrieved ${addresses.length} addresses for user: ${userId}`);
      return ResponseUtil.success(res, { addresses });
    } catch (error: any) {
      Logger.error('AddressBookController', 'Error getting address book', error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * 添加地址到用户的地址簿
   */
  static async addAddress(req: Request & { user?: any }, res: Response) {
    try {
      Logger.debug('AddressBookController', 'Adding address to address book');
      
      if (!AddressBookController.validateUserAccess(req, res)) return;

      // 验证请求体
      const validationResult = addressBookEntrySchema.safeParse(req.body);
      
      if (!validationResult.success) {
        Logger.warn('AddressBookController', 'Invalid request parameters for adding address', validationResult.error.format());
        return ResponseUtil.error(
          res,
          'Invalid request parameters',
          400,
          'VALIDATION_ERROR',
          validationResult.error.format()
        );
      }
      
      const { name, address, description } = validationResult.data;
      const { userId: rawUserId } = req.params;
      const userId = decodeURIComponent(rawUserId);
      
      // 添加新地址 (允许重复添加相同地址)
      const now = new Date();
      const newAddress = await db.insert(addressBook).values({
        privyUserId: userId,
        name,
        address,
        description,
        createdAt: now,
        updatedAt: now
      }).returning();
      
      Logger.info('AddressBookController', `Successfully added address ${address} for user ${userId}`);
      return ResponseUtil.success(
        res,
        newAddress[0],
        'Address added successfully'
      );
    } catch (error: any) {
      Logger.error('AddressBookController', 'Error adding address', error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * 更新地址簿中的地址
   */
  static async updateAddress(req: Request & { user?: any }, res: Response) {
    try {
      const { addressId, userId: rawUserId } = req.params;
      const userId = decodeURIComponent(rawUserId);
      Logger.debug('AddressBookController', `Updating address with ID: ${addressId}`);
      
      if (!AddressBookController.validateUserAccess(req, res)) return;

      if (!addressId || isNaN(parseInt(addressId))) {
        Logger.warn('AddressBookController', `Invalid address ID: ${addressId}`);
        return ResponseUtil.error(
          res,
          'Invalid address ID',
          400,
          'INVALID_ID'
        );
      }

      // 验证请求体
      const validationResult = addressBookEntrySchema.safeParse(req.body);
      
      if (!validationResult.success) {
        Logger.warn('AddressBookController', 'Invalid request parameters for updating address', validationResult.error.format());
        return ResponseUtil.error(
          res,
          'Invalid request parameters',
          400,
          'VALIDATION_ERROR',
          validationResult.error.format()
        );
      }
      
      const { name, address, description } = validationResult.data;
      
      // 检查地址是否存在且属于当前用户
      const existingAddress = await db.select().from(addressBook).where(
        and(
          eq(addressBook.id, parseInt(addressId)),
          eq(addressBook.privyUserId, userId)
        )
      );
      
      if (existingAddress.length === 0) {
        Logger.warn('AddressBookController', `Address with ID ${addressId} not found for user ${userId}`);
        return ResponseUtil.error(
          res,
          'Address not found in your address book',
          404,
          'ADDRESS_NOT_FOUND'
        );
      }
      
      // 更新地址
      const updatedAddress = await db.update(addressBook)
        .set({
          name,
          address,
          description,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(addressBook.id, parseInt(addressId)),
            eq(addressBook.privyUserId, userId)
          )
        )
        .returning();
      
      Logger.info('AddressBookController', `Successfully updated address with ID ${addressId} for user ${userId}`);
      return ResponseUtil.success(
        res,
        updatedAddress[0],
        'Address updated successfully'
      );
    } catch (error: any) {
      Logger.error('AddressBookController', `Error updating address ${req.params.addressId}`, error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * 删除地址簿中的地址
   */
  static async deleteAddress(req: Request & { user?: any }, res: Response) {
    try {
      const { addressId, userId: rawUserId } = req.params;
      const userId = decodeURIComponent(rawUserId);
      Logger.debug('AddressBookController', `Deleting address with ID: ${addressId}`);
      
      if (!AddressBookController.validateUserAccess(req, res)) return;

      if (!addressId || isNaN(parseInt(addressId))) {
        Logger.warn('AddressBookController', `Invalid address ID: ${addressId}`);
        return ResponseUtil.error(
          res,
          'Invalid address ID',
          400,
          'INVALID_ID'
        );
      }
      
      // 检查地址是否存在且属于当前用户
      const existingAddress = await db.select().from(addressBook).where(
        and(
          eq(addressBook.id, parseInt(addressId)),
          eq(addressBook.privyUserId, userId)
        )
      );
      
      if (existingAddress.length === 0) {
        Logger.warn('AddressBookController', `Address with ID ${addressId} not found for user ${userId}`);
        return ResponseUtil.error(
          res,
          'Address not found in your address book',
          404,
          'ADDRESS_NOT_FOUND'
        );
      }
      
      // 删除地址
      await db.delete(addressBook).where(
        and(
          eq(addressBook.id, parseInt(addressId)),
          eq(addressBook.privyUserId, userId)
        )
      );
      
      Logger.info('AddressBookController', `Successfully deleted address with ID ${addressId} for user ${userId}`);
      return ResponseUtil.success(
        res,
        null,
        'Address deleted successfully'
      );
    } catch (error: any) {
      Logger.error('AddressBookController', `Error deleting address ${req.params.addressId}`, error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }
} 