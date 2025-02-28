import { Request, Response, NextFunction } from 'express';
import { AppError } from './error';
import { privyService } from '../services/PrivyService';

/**
 * API 身份验证中间件
 * 验证请求中的 API 密钥
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('未提供有效的授权令牌', 401, 'UNAUTHORIZED');
  }
  
  const token = authHeader.split(' ')[1];
  const validApiKey = process.env.SERVICE_API_KEY || 'test-api-key';
  
  if (token !== validApiKey) {
    throw new AppError('无效的API密钥', 401, 'UNAUTHORIZED');
  }
  
  next();
}

/**
 * Privy 认证中间件
 * 验证请求中的 Privy ID 令牌，提取用户信息并将其附加到请求对象
 */
export const privyAuth = async (
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) => {
  // 从请求头或 cookie 中获取 ID 令牌
  const idToken = 
    req.headers['x-privy-token'] as string || 
    req.cookies?.['privy-id-token'];

  if (!idToken) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: No authentication token provided'
    });
    return;
  }

  try {
    // 验证令牌并获取用户信息
    const user = await privyService.getUserFromIdToken(idToken);
    
    // 将用户信息附加到请求对象，供后续路由处理程序使用
    req.user = user;
    
    next();
  } catch (error: any) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: `Unauthorized: ${error.message}`
    });
  }
}; 