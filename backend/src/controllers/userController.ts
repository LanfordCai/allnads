import { Request, Response } from 'express';
import { privyService } from '../services/PrivyService';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

export class UserController {
  static async getCurrentUser(req: Request & { user?: any }, res: Response) {
    try {
      Logger.debug('UserController', 'Getting current user info');
      
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

      if (req.user && req.user.id !== userId) {
        Logger.warn('UserController', `User ${req.user.id} attempted to delete another user: ${userId}`);
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