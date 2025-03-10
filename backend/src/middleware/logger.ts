import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

/**
 * Request logging middleware
 * Records information for all incoming requests and response times
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Record request start time
  const startTime = Date.now();
  
  // Log request information
  Logger.logRequest(req, 'HTTP');
  
  // Record when response completes
  res.on('finish', () => {
    // Log response information, including status code and processing time
    Logger.logResponse(res, 'HTTP', startTime);
  });
  
  next();
}; 