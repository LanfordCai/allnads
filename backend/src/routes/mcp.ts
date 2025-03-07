import express, { RequestHandler } from 'express';
import { MCPController } from '../controllers/mcp';
import { serviceAuth } from '../middleware/auth';
import { setControllerContext } from '../middleware/context';

const router = express.Router();

// 添加控制器上下文中间件
router.use(setControllerContext('MCPController'));

// 应用鉴权中间件
router.use(serviceAuth);

// GET /api/mcp/servers - 获取所有MCP服务器
router.get('/servers', MCPController.getServers as RequestHandler);

// GET /api/mcp/tools - 获取所有工具（可选参数server）
router.get('/tools', MCPController.getTools as RequestHandler);

// POST /api/mcp/servers - 添加MCP服务器
router.post('/servers', MCPController.addServer as RequestHandler);

// DELETE /api/mcp/servers/:id - 删除MCP服务器
router.delete('/servers/:id', MCPController.removeServer as RequestHandler);

export { router as mcpRouter }; 