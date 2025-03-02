import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { chatRouter } from './routes/chat';
import { mcpRouter } from './routes/mcp';
import { userRouter } from './routes/user';
import { nftRouter } from './routes/nft';
import { notFoundHandler, errorHandler } from './middleware/error';
import { initializeMCPServers } from './services/mcpService';
import { SessionService } from './services/session';
import { closeDatabase } from './config/database';
import { initializeChatWebSocket, closeChatWebSocket } from './routes/chatSocket';
import { requestLogger } from './middleware/logger';
import { Logger } from './utils/logger';

// ES Modules 兼容性: 获取 __dirname 的等效值
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// 定义关闭应用程序的函数
function setupShutdownHandlers(server: http.Server) {
  const shutdown = async () => {
    console.log('正在关闭服务器...');
    server.close(() => {
      console.log('HTTP服务器已关闭');
    });
    
    // 关闭WebSocket连接
    closeChatWebSocket();
    console.log('WebSocket连接已关闭');
    
    // 关闭数据库连接
    await closeDatabase();
    console.log('数据库连接已关闭');
    
    console.log('应用程序已安全关闭');
    process.exit(0);
  };

  // 注册进程事件处理程序
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    shutdown();
  });
}

// 初始化服务
async function initializeServer(): Promise<void> {
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // 请求日志中间件 - 在所有其他中间件之前添加
  app.use(requestLogger);
  
  // API routes - 添加日志中间件后再注册路由
  app.use('/api/health', healthRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/mcp', mcpRouter);
  app.use('/api/users', userRouter);
  app.use('/api/nft', nftRouter);
  
  // 静态文件
  app.use(express.static(path.join(__dirname, '../public')));
  
  // 处理404和错误
  app.use(notFoundHandler);
  app.use(errorHandler);

  // 初始化WebSocket聊天服务
  Logger.info('Server', '正在初始化WebSocket聊天服务...');
  initializeChatWebSocket(server);
  Logger.info('Server', 'WebSocket聊天服务已初始化');

  // 初始化MCP服务器连接
  Logger.info('Server', '正在连接MCP服务器...');
  try {
    const success = await initializeMCPServers();
    if (success) {
      Logger.info('Server', 'MCP服务器连接成功');
    } else {
      Logger.warn('Server', '部分MCP服务器连接失败，某些功能可能不可用');
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('Server', `MCP服务器连接失败: ${errorMessage}`, err);
    Logger.warn('Server', '系统将在无MCP支持的情况下运行，工具调用功能不可用');
  }

  // 加载所有会话
  Logger.info('Server', '正在加载聊天会话数据...');
  try {
    await SessionService.loadAllSessions();
    Logger.info('Server', '聊天会话数据加载成功');
  } catch (error) {
    Logger.error('Server', '聊天会话数据加载失败', error);
    Logger.warn('Server', '系统将使用空的会话数据启动');
  }

  // Start server (使用http.Server而不是app)
  const PORT = env.PORT;
  server.listen(PORT, () => {
    Logger.info('Server', `服务器已启动，运行在端口 ${PORT}，模式：${env.NODE_ENV}`);
    Logger.info('Server', `健康检查: http://localhost:${PORT}/api/health`);
    Logger.info('Server', `聊天 API: http://localhost:${PORT}/api/chat`);
    Logger.info('Server', `WebSocket 聊天: ws://localhost:${PORT}/ws`);
    Logger.info('Server', `WebSocket 聊天示例: http://localhost:${PORT}/websocket-chat`);
    Logger.info('Server', `MCP API: http://localhost:${PORT}/api/mcp`);
    Logger.info('Server', `用户 API: http://localhost:${PORT}/api/users`);
  });

  // 处理进程退出
  setupShutdownHandlers(server);
}

// 启动服务器
initializeServer().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error(`服务器启动失败: ${errorMessage}`, err);
  process.exit(1);
}); 