import { Request, Response, NextFunction } from 'express';

export const setControllerContext = (controllerName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.locals.controller = controllerName;
    next();
  };
}; 