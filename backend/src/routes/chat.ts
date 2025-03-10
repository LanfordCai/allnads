import express, { RequestHandler } from 'express';
import { ChatController } from '../controllers/chatController';
import { privyAuth } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = express.Router();

// Add controller context middleware
router.use(setControllerContext('ChatController'));

// Apply authentication middleware
router.use(privyAuth);

// GET /api/chat/sessions - Get all sessions
router.get('/sessions', ChatController.getAllSessions as RequestHandler);

// GET /api/chat/sessions/:sessionId - Get session history
router.get('/sessions/:sessionId', ChatController.getSessionHistory as RequestHandler);

// DELETE /api/chat/sessions/:sessionId - Delete session
router.delete('/sessions/:sessionId', ChatController.deleteSession as RequestHandler);

export { router as chatRouter }; 