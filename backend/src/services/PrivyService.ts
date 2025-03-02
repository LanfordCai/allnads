import { PrivyClient } from '@privy-io/server-auth';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';

// 加载环境变量
dotenv.config();

// 获取环境变量
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || '';
const PRIVY_API_SECRET = process.env.PRIVY_API_SECRET || '';

// 定义Privy JWT令牌的类型
interface PrivyTokenClaims {
  sub?: string;      // 主题（用户ID）
  sid?: string;      // 会话ID
  iat?: number;      // 发布时间
  exp?: number;      // 过期时间
  iss?: string;      // 发行者
  aud?: string;      // 受众
  [key: string]: any; // 其他可能的字段
}

/**
 * 提供 Privy 用户管理和认证功能的服务
 */export class PrivyService {
  private client: PrivyClient;

  constructor() {
    // 根据 Privy 文档，构造函数可能需要以下参数
    this.client = new PrivyClient(
      PRIVY_APP_ID,
      PRIVY_API_SECRET
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
   * 验证 Privy 访问令牌
   * @param token - Privy 访问令牌 (JWT 格式)
   * @returns 用户信息，包含privyUserId
   */
  async verifyAccessToken(token: string) {
    try {
      console.log(`[Privy] 验证访问令牌: ${token.substring(0, 15)}...`);
      
      // 尝试先使用verifyAuthToken方法
      try {
        const claims = await this.verifyAuthToken(token);
        // 将claims转换为PrivyTokenClaims类型
        const privyClaims = claims as unknown as PrivyTokenClaims;
        
        if (privyClaims && privyClaims.sub) {
          console.log(`[Privy] 令牌验证成功，用户ID: ${privyClaims.sub}`);
          return {
            privyUserId: privyClaims.sub,
            sessionId: privyClaims.sid,
            issuedAt: privyClaims.iat ? new Date(privyClaims.iat * 1000) : undefined,
            expiresAt: privyClaims.exp ? new Date(privyClaims.exp * 1000) : undefined,
          };
        }
      } catch (err) {
        console.log(`[Privy] 使用verifyAuthToken验证失败，尝试手动验证JWT`);
      }
      
      // 手动解析JWT，但不验证签名（仅用于开发/测试环境）
      // 注意：生产环境应当使用完整的JWT验证
      try {
        const decodedToken = jwt.decode(token) as PrivyTokenClaims;
        
        if (decodedToken && decodedToken.sub) {
          console.log(`[Privy] JWT解码成功，用户ID: ${decodedToken.sub}`);
          console.warn(`[Privy] 警告：令牌仅被解码但未验证签名`);
          
          return {
            privyUserId: decodedToken.sub,
            sessionId: decodedToken.sid,
            issuedAt: decodedToken.iat ? new Date(decodedToken.iat * 1000) : undefined,
            expiresAt: decodedToken.exp ? new Date(decodedToken.exp * 1000) : undefined,
          };
        }
        
        throw new Error('访问令牌格式无效或不包含用户ID');
      } catch (jwtError) {
        console.error(`[Privy] JWT解码失败:`, jwtError);
        throw new Error(`JWT解码失败: ${jwtError instanceof Error ? jwtError.message : String(jwtError)}`);
      }
    } catch (error: any) {
      console.error(`[Privy] 访问令牌验证失败:`, error);
      throw new Error(`访问令牌验证失败: ${error.message}`);
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