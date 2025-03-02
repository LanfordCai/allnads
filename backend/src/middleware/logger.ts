import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

/**
 * 请求日志中间件
 * 记录所有传入请求的信息和响应时间
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // 记录请求开始时间
  const startTime = Date.now();
  
  // 记录请求信息
  Logger.logRequest(req, 'HTTP');
  
  // 在响应完成时进行记录
  res.on('finish', () => {
    // 记录响应信息，包括状态码和处理时间
    Logger.logResponse(res, 'HTTP', startTime);
  });
  
  next();
}; 