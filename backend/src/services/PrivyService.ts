import { PrivyClient } from '@privy-io/server-auth';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 获取环境变量
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || '';
const PRIVY_API_KEY = process.env.PRIVY_API_KEY || '';
const PRIVY_API_SECRET = process.env.PRIVY_API_SECRET || '';

/**
 * 提供 Privy 用户管理和认证功能的服务
 */
export class PrivyService {
  private client: PrivyClient;

  constructor() {
    // 根据 Privy 文档，构造函数可能需要以下参数
    this.client = new PrivyClient(
      PRIVY_APP_ID,
      PRIVY_API_KEY
    );
  }

  /**
   * 验证 Privy 认证令牌
   * @param token - Privy 认证令牌
   * @returns 用户信息
   */
  async verifyAuthToken(token: string) {
    try {
      const verifiedClaims = await this.client.verifyAuthToken(token);
      return verifiedClaims;
    } catch (error: any) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * 从身份令牌获取用户信息（推荐方法）
   * @param idToken - Privy 身份令牌
   * @returns 用户信息
   */
  async getUserFromIdToken(idToken: string) {
    try {
      const user = await this.client.getUser({idToken});
      return user;
    } catch (error: any) {
      throw new Error(`Failed to get user from ID token: ${error.message}`);
    }
  }

  /**
   * 根据用户ID获取用户信息（不推荐使用）
   * @param userId - Privy 用户 ID
   * @returns 用户信息
   */
  async getUserById(userId: string) {
    try {
      const user = await this.client.getUser(userId);
      return user;
    } catch (error: any) {
      throw new Error(`Failed to get user by ID: ${error.message}`);
    }
  }

  /**
   * 从请求中提取用户信息
   * 假设 idToken 作为 cookie 被发送
   * @param req - HTTP 请求对象
   * @returns 用户信息
   */
  async getUserFromRequest(req: any) {
    try {
      const idToken = req.cookies?.['privy-id-token'];
      if (!idToken) {
        throw new Error('No Privy identity token found in request');
      }
      
      return await this.getUserFromIdToken(idToken);
    } catch (error: any) {
      throw new Error(`Failed to get user from request: ${error.message}`);
    }
  }

  /**
   * 删除用户
   * @param userId - Privy 用户 ID
   */
  async deleteUser(userId: string) {
    try {
      await this.client.deleteUser(userId);
    } catch (error: any) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}

export const privyService = new PrivyService(); 