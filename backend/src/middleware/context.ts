import { Request, Response, NextFunction } from 'express';

/**
 * 控制器上下文中间件
 * 
 * @param controllerName 控制器名称
 * @returns 中间件函数
 */
export const setControllerContext = (controllerName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 在res.locals中设置控制器名称，以便在响应工具和日志中使用
    res.locals.controller = controllerName;
    next();
  };
}; 