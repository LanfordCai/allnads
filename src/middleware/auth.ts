import { Request, Response, NextFunction } from 'express';
import { AppError } from './error';

/**
 * 身份验证中间件
 * 验证请求中的API密钥
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