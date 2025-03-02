import { Request, Response } from 'express';
import { privyService } from '../services/PrivyService';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

/**
 * 用户控制器，处理用户相关的请求
 */
export class UserController {
  /**
   * 获取当前认证用户的信息
   */
  static async getCurrentUser(req: Request & { user?: any }, res: Response) {
    try {
      Logger.debug('UserController', 'Getting current user info');
      
      // 用户信息已通过中间件附加到请求对象
      if (!req.user) {
        Logger.warn('UserController', 'User not authenticated when accessing getCurrentUser');
        return ResponseUtil.error(
          res, 
          'User not authenticated',
          401,
          'AUTH_REQUIRED'
        );
      }

      Logger.debug('UserController', `User authenticated: ${req.user.id}`);
      
      return ResponseUtil.success(res, req.user);
    } catch (error: any) {
      Logger.error('UserController', 'Error getting current user', error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * 获取特定用户的信息 (仅限管理员)
   */
  static async getUserById(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      Logger.debug('UserController', `Getting user by ID: ${userId}`);

      if (!userId) {
        Logger.warn('UserController', 'User ID is required but was not provided');
        return ResponseUtil.error(
          res, 
          'User ID is required',
          400,
          'MISSING_PARAM'
        );
      }

      const user = await privyService.getUserById(userId);
      Logger.info('UserController', `Successfully retrieved user: ${userId}`);

      return ResponseUtil.success(res, user);
    } catch (error: any) {
      Logger.error('UserController', `Error getting user ${req.params.userId}`, error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * 删除用户 (仅限管理员或用户自己)
   */
  static async deleteUser(req: Request & { user?: any }, res: Response) {
    try {
      const { userId } = req.params;
      Logger.debug('UserController', `Deleting user: ${userId}`);

      if (!userId) {
        Logger.warn('UserController', 'User ID is required but was not provided');
        return ResponseUtil.error(
          res, 
          'User ID is required',
          400,
          'MISSING_PARAM'
        );
      }

      // 检查是否是当前用户删除自己的账户
      if (req.user && req.user.id !== userId) {
        Logger.warn('UserController', `User ${req.user.id} attempted to delete another user: ${userId}`);
        // 此处可以添加管理员权限检查
        return ResponseUtil.error(
          res, 
          'Forbidden: You can only delete your own account',
          403,
          'FORBIDDEN'
        );
      }

      await privyService.deleteUser(userId);
      Logger.info('UserController', `Successfully deleted user: ${userId}`);

      return ResponseUtil.success(
        res, 
        null, 
        'User deleted successfully'
      );
    } catch (error: any) {
      Logger.error('UserController', `Error deleting user ${req.params.userId}`, error);
      return ResponseUtil.error(
        res, 
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }
} 