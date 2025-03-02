import { Response } from 'express';
import { Logger } from './logger';

/**
 * API响应标准格式
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
 * 响应工具类
 * 提供统一的API响应格式和日志记录
 */
export class ResponseUtil {
  /**
   * 发送成功响应
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

    // 记录响应信息
    const logContext = ResponseUtil.getControllerContext(res);
    Logger.debug(logContext, `成功响应: ${statusCode} ${message || ''}`);

    res.status(statusCode).json(response);
  }

  /**
   * 发送错误响应
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

    // 记录错误响应
    const logContext = ResponseUtil.getControllerContext(res);
    Logger.warn(logContext, `错误响应: ${statusCode} ${errorCode || ''} - ${message}`);

    res.status(statusCode).json(response);
  }

  /**
   * 从响应对象中获取控制器上下文
   * 用于日志记录
   */
  private static getControllerContext(res: Response): string {
    // 尝试获取控制器名称，如果无法获取则使用默认值
    // 此处可以通过res.locals传递控制器信息
    return res.locals?.controller || 'API';
  }
} 