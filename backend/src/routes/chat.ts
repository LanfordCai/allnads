import express, { RequestHandler } from 'express';
import { ChatController } from '../controllers/chat';
import { authenticate } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = express.Router();

// 添加控制器上下文中间件
router.use(setControllerContext('ChatController'));

// 应用鉴权中间件
router.use(authenticate);

// POST /api/chat/tools - 直接调用工具
router.post('/tools', ChatController.callTool as RequestHandler);

// GET /api/chat/sessions - 获取所有会话
router.get('/sessions', ChatController.getAllSessions as RequestHandler);

// GET /api/chat/sessions/:sessionId - 获取会话历史
router.get('/sessions/:sessionId', ChatController.getSessionHistory as RequestHandler);

// DELETE /api/chat/sessions/:sessionId - 删除会话
router.delete('/sessions/:sessionId', ChatController.deleteSession as RequestHandler);

export { router as chatRouter }; 