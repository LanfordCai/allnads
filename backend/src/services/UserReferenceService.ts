import { db } from '../config/database';
import { userReferences } from '../models/schema';
import { eq } from 'drizzle-orm';

interface UserData {
  username?: string;
  email?: string;
  metadata?: Record<string, any>;
}

/**
 * 用户引用服务 - 管理 Privy 用户与应用内数据的关联
 */
export class UserReferenceService {
  /**
   * 创建或更新用户引用
   */
  static async createOrUpdateUser(privyUserId: string, userData: UserData): Promise<boolean> {
    try {
      // 检查用户是否已存在
      const existingUser = await this.getUserByPrivyId(privyUserId);
      
      if (existingUser) {
        // 更新现有用户
        await db.update(userReferences)
          .set({
            username: userData.username || existingUser.username,
            email: userData.email || existingUser.email,
            metadata: userData.metadata || existingUser.metadata,
            lastLoginAt: new Date(),
          })
          .where(eq(userReferences.privyUserId, privyUserId));
      } else {
        // 创建新用户
        await db.insert(userReferences).values({
          privyUserId,
          username: userData.username,
          email: userData.email,
          metadata: userData.metadata,
          createdAt: new Date(),
          lastLoginAt: new Date(),
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Error creating/updating user reference for ${privyUserId}:`, error);
      return false;
    }
  }

  /**
   * 获取用户引用
   */
  static async getUserByPrivyId(privyUserId: string) {
    try {
      const users = await db.select().from(userReferences)
        .where(eq(userReferences.privyUserId, privyUserId));
      
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error(`Error getting user reference for ${privyUserId}:`, error);
      return null;
    }
  }

  /**
   * 删除用户引用
   */
  static async deleteUser(privyUserId: string): Promise<boolean> {
    try {
      const result = await db.delete(userReferences)
        .where(eq(userReferences.privyUserId, privyUserId));
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error(`Error deleting user reference for ${privyUserId}:`, error);
      return false;
    }
  }

  /**
   * 获取所有用户引用
   */
  static async getAllUsers() {
    try {
      return await db.select().from(userReferences);
    } catch (error) {
      console.error('Error getting all user references:', error);
      return [];
    }
  }
}

export const userReferenceService = new UserReferenceService(); 