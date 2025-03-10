import express, { RequestHandler } from 'express';
import { MCPController } from '../controllers/mcpController';
import { serviceAuth } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = express.Router();

router.use(setControllerContext('MCPController'));

router.use(serviceAuth);

router.get('/servers', MCPController.getServers as RequestHandler);
router.get('/tools', MCPController.getTools as RequestHandler);
router.post('/servers', MCPController.addServer as RequestHandler);
router.delete('/servers/:id', MCPController.removeServer as RequestHandler);

export { router as mcpRouter }; 