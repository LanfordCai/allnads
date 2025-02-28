import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { chatRouter } from './routes/chat';
import { mcpRouter } from './routes/mcp';
import { userRouter } from './routes/user';
import { notFoundHandler, errorHandler } from './middleware/error';
import { initializeMCPServers } from './services/mcpService';
import { SessionService } from './services/session';
import { closeDatabase } from './config/database';

// 初始化服务
async function initializeServer() {
  // Initialize Express app
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(cors());

  // Routes
  app.use('/api/health', healthRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/mcp', mcpRouter);
  app.use('/api/users', userRouter);

  // 404 处理中间件
  app.use(notFoundHandler);

  // 异常处理中间件
  app.use(errorHandler);

  // 初始化MCP服务器连接
  console.log('🔌 正在连接MCP服务器...');
  try {
    const success = await initializeMCPServers();
    if (success) {
      console.log('✅ MCP服务器连接成功');
    } else {
      console.warn('⚠️ 部分MCP服务器连接失败，某些功能可能不可用');
    }
  } catch (err: any) {
    console.error('❌ MCP服务器连接失败:', err.message);
    console.warn('⚠️ 系统将在无MCP支持的情况下运行，工具调用功能不可用');
  }

  // 加载所有会话
  console.log('💾 正在加载聊天会话数据...');
  try {
    await SessionService.loadAllSessions();
    console.log('✅ 聊天会话数据加载成功');
  } catch (error) {
    console.error('❌ 聊天会话数据加载失败:', error);
    console.warn('⚠️ 系统将使用空的会话数据启动');
  }

  // Start server
  const PORT = env.PORT;
  app.listen(PORT, () => {
    console.log(`🚀 服务器已启动，运行在端口 ${PORT}，模式：${env.NODE_ENV}`);
    console.log(`👉 健康检查: http://localhost:${PORT}/api/health`);
    console.log(`👉 聊天 API: http://localhost:${PORT}/api/chat`);
    console.log(`👉 MCP API: http://localhost:${PORT}/api/mcp`);
    console.log(`👉 用户 API: http://localhost:${PORT}/api/users`);
  });

  // 处理进程退出
  setupShutdownHandlers();
}

// 设置关闭处理程序
function setupShutdownHandlers() {
  // 处理进程退出信号
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // 优雅退出
  async function gracefulShutdown() {
    console.log('🛑 接收到退出信号，正在优雅关闭服务...');
    
    // 关闭数据库连接
    await closeDatabase();
    
    console.log('👋 服务已安全关闭');
    process.exit(0);
  }
}

// 启动服务器
initializeServer().catch((error) => {
  console.error('服务器初始化失败:', error);
  process.exit(1);
}); 