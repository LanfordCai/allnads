import { db } from '../config/database';
import { userReferences } from '../models/schema';
import { eq } from 'drizzle-orm';

interface UserData {
  username?: string;
  email?: string;
  metadata?: Record<string, any>;
}

/**
 * User Reference Service - Manages associations between Privy users and application data
 */
export class UserReferenceService {
  /**
   * Create or update user reference
   */
  static async createOrUpdateUser(privyUserId: string, userData: UserData): Promise<boolean> {
    try {
      // Check if user already exists
      const existingUser = await this.getUserByPrivyId(privyUserId);
      
      if (existingUser) {
        // Update existing user
        await db.update(userReferences)
          .set({
            username: userData.username || existingUser.username,
            email: userData.email || existingUser.email,
            metadata: userData.metadata || existingUser.metadata,
            lastLoginAt: new Date(),
          })
          .where(eq(userReferences.privyUserId, privyUserId));
      } else {
        // Create new user
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
   * Get user reference
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
   * Delete user reference
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
   * Get all user references
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