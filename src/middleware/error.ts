import { Request, Response, NextFunction } from 'express';

/**
 * 自定义错误类
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  
  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 错误处理中间件
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    status: 'error',
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
    },
  });
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Unhandled error:', err);
  
  // 默认错误状态和信息
  let statusCode = 500;
  let errorMessage = 'Internal Server Error';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  
  // 自定义 AppError 信息
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
    errorCode = err.code;
  } else if (err instanceof Error) {
    errorMessage = err.message;
  }
  
  // 返回 JSON 错误响应
  res.status(statusCode).json({
    status: 'error',
    error: {
      message: errorMessage,
      code: errorCode,
    },
  });
} 