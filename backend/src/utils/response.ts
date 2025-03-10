import { Response } from 'express';
import { Logger } from './logger';

/**
 * API response standard format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    details?: any;
  };
}

/**
 * Response utility class
 * Provides unified API response format and logging
 */
export class ResponseUtil {
  /**
   * Send success response
   */
  static success<T = any>(
    res: Response, 
    data?: T, 
    message?: string, 
    statusCode: number = 200
  ): void {
    const response: ApiResponse<T> = {
      success: true
    };

    if (data !== undefined) {
      response.data = data;
    }

    if (message) {
      response.message = message;
    }

    // Log response information
    const logContext = ResponseUtil.getControllerContext(res);
    Logger.debug(logContext, `Success response: ${statusCode} ${message || ''}`);

    res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response, 
    message: string, 
    statusCode: number = 500, 
    errorCode?: string,
    details?: any
  ): void {
    const response: ApiResponse = {
      success: false,
      message
    };

    if (errorCode || details) {
      response.error = {
        ...(errorCode && { code: errorCode }),
        ...(details && { details })
      };
    }

    // Log error response
    const logContext = ResponseUtil.getControllerContext(res);
    Logger.warn(logContext, `Error response: ${statusCode} ${errorCode || ''} - ${message}`);

    res.status(statusCode).json(response);
  }

  /**
   * Get controller context from response object
   * Used for logging
   */
  private static getControllerContext(res: Response): string {
    // Try to get controller name, use default value if unable to get
    // Controller information can be passed through res.locals
    return res.locals?.controller || 'API';
  }
} 