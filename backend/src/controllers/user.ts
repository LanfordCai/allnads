import { Request, Response } from 'express';
import { privyService } from '../services/PrivyService';

/**
 * 用户控制器，处理用户相关的请求
 */
export class UserController {
  /**
   * 获取当前认证用户的信息
   */
  static async getCurrentUser(req: Request & { user?: any }, res: Response) {
    try {
      // 用户信息已通过中间件附加到请求对象
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      res.json({
        success: true,
        data: req.user
      });
    } catch (error: any) {
      console.error('Error getting current user:', error);
      res.status(500).json({
        success: false,
        message: `Internal server error: ${error.message}`
      });
    }
  }

  /**
   * 获取特定用户的信息 (仅限管理员)
   */
  static async getUserById(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const user = await privyService.getUserById(userId);

      res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      console.error(`Error getting user ${req.params.userId}:`, error);
      res.status(500).json({
        success: false,
        message: `Internal server error: ${error.message}`
      });
    }
  }

  /**
   * 删除用户 (仅限管理员或用户自己)
   */
  static async deleteUser(req: Request & { user?: any }, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      // 检查是否是当前用户删除自己的账户
      if (req.user && req.user.id !== userId) {
        // 此处可以添加管理员权限检查
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only delete your own account'
        });
        return;
      }

      await privyService.deleteUser(userId);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      console.error(`Error deleting user ${req.params.userId}:`, error);
      res.status(500).json({
        success: false,
        message: `Internal server error: ${error.message}`
      });
    }
  }
} 