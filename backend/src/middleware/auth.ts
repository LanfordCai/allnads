import { Request, Response, NextFunction } from 'express';
import { AppError } from './error';
import { privyService } from '../services/PrivyService';

// Service API key verification helper
const verifyServiceApiKey = (token: string): boolean => {
  const validApiKey = process.env.SERVICE_API_KEY || 'test-api-key';
  return token === validApiKey;
};

/**
 * Service API 身份验证中间件
 * 仅验证请求中的 API 密钥
 */
export const serviceAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('未提供有效的授权令牌', 401, 'UNAUTHORIZED');
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!verifyServiceApiKey(token)) {
    throw new AppError('无效的API密钥', 401, 'UNAUTHORIZED');
  }
  
  next();
}

export const privyAuth = async (
  req: Request & { user?: any; isService?: boolean },
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const idToken = req.headers['x-privy-token'] as string || 
                 req.cookies?.['privy-id-token'];

  if (!authHeader) {
    throw new AppError('Authorization header is required', 401, 'UNAUTHORIZED');
  }

  // Check for service API key
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    // If it's a service API key
    if (verifyServiceApiKey(token)) {
      try {
        if (!idToken) {
          throw new AppError('ID token is required even for service access', 401, 'UNAUTHORIZED');
        }
        const user = await privyService.getUserFromIdToken(idToken);
        req.user = user;
        req.isService = true; // Mark the request as service
        return next();
      } catch (error: any) {
        console.error('Service authentication error:', error);
        throw new AppError(`Service authentication failed: ${error.message}`, 401, 'UNAUTHORIZED');
      }
    }

    // Regular user authentication flow
    if (!idToken) {
      throw new AppError('Both access token and ID token are required for user access', 401, 'UNAUTHORIZED');
    }

    try {
      // Verify both tokens and get user information
      const [accessTokenData, user] = await Promise.all([
        privyService.verifyAccessToken(token),
        privyService.getUserFromIdToken(idToken)
      ]);

      // Verify that both tokens belong to the same user
      if (accessTokenData.privyUserId !== user.id) {
        throw new Error('Token mismatch: Access token and ID token belong to different users');
      }

      // Attach verified user data to request
      req.user = user;
      req.isService = false;
      
      next();
    } catch (error: any) {
      console.error('Authentication error:', error);
      throw new AppError(`Authentication failed: ${error.message}`, 401, 'UNAUTHORIZED');
    }
  } else {
    throw new AppError('Invalid Authorization header format', 401, 'UNAUTHORIZED');
  }
};

export const basicPrivyAuth = async (
  req: Request & { user?: any; isService?: boolean },
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('Authorization header is required', 401, 'UNAUTHORIZED');
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    // Check for service API key first
    if (verifyServiceApiKey(token)) {
      req.isService = true;
      return next();
    }

    // If not a service key, verify as regular access token
    try {
      const accessTokenData = await privyService.verifyAccessToken(token);
      req.user = { id: accessTokenData.privyUserId };
      req.isService = false;
      next();
    } catch (error: any) {
      console.error('Authentication error:', error);
      throw new AppError(`Authentication failed: ${error.message}`, 401, 'UNAUTHORIZED');
    }
  } else {
    throw new AppError('Invalid Authorization header format', 401, 'UNAUTHORIZED');
  }
};