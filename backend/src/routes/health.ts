import express from 'express';
import { env } from '../config/env';
import { setControllerContext } from '../middleware/context';
import { ResponseUtil } from '../utils/response';

const router = express.Router();

// 添加控制器上下文中间件
router.use(setControllerContext('Health'));

// GET /api/health - Health check endpoint
router.get('/', (req, res) => {
  return ResponseUtil.success(
    res, 
    {
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, 
    'API is running'
  );
});

export { router as healthRouter }; 