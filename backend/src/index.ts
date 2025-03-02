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
import { notFoundHandler, errorHandler } from './middleware/error';
import { initializeMCPServers } from './services/mcpService';
import { SessionService } from './services/session';
import { closeDatabase } from './config/database';
import { initializeChatWebSocket, closeChatWebSocket } from './routes/chatSocket';

// ES Modules 兼容性: 获取 __dirname 的等效值
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化服务
async function initializeServer() {
  // Initialize Express app
  const app = express();
  
  // 创建 HTTP 服务器实例
  const server = http.createServer(app);

  // Middleware
  app.use(express.json());
  app.use(cors());
  
  // 设置静态文件服务
  // 为示例目录添加静态文件服务，使示例HTML可访问
  // 尝试多个可能的路径
  let examplesPath = path.join(path.dirname(__dirname), 'src', 'examples');
  const fallbackPath = path.join(__dirname, 'examples');
  const fs = await import('fs');
  
  // 检查目录是否存在
  try {
    if (!fs.existsSync(examplesPath)) {
      console.log(`主要示例路径不存在: ${examplesPath}，尝试备用路径`);
      if (fs.existsSync(fallbackPath)) {
        examplesPath = fallbackPath;
        console.log(`使用备用示例路径: ${examplesPath}`);
      } else {
        console.warn(`示例目录未找到，WebSocket示例可能无法访问`);
      }
    } else {
      console.log(`找到示例目录: ${examplesPath}`);
    }
    
    app.use('/examples', express.static(examplesPath));
    
    // 示例页面路由
    app.get('/websocket-chat', (req, res) => {
      const htmlPath = path.join(examplesPath, 'websocketChat.html');
      if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
      } else {
        res.status(404).send('WebSocket示例文件未找到。请确保 websocketChat.html 文件存在于正确的位置。');
      }
    });
  } catch (error) {
    console.error('设置静态文件服务时出错:', error);
  }

  // Routes
  app.use('/api/health', healthRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/mcp', mcpRouter);
  app.use('/api/users', userRouter);
  
  // 404 处理中间件
  app.use(notFoundHandler);

  // 异常处理中间件
  app.use(errorHandler);

  // 初始化WebSocket聊天服务
  initializeChatWebSocket(server);
  console.log('🔌 WebSocket聊天服务已初始化');

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

  // Start server (使用http.Server而不是app)
  const PORT = env.PORT;
  server.listen(PORT, () => {
    console.log(`🚀 服务器已启动，运行在端口 ${PORT}，模式：${env.NODE_ENV}`);
    console.log(`👉 健康检查: http://localhost:${PORT}/api/health`);
    console.log(`👉 聊天 API: http://localhost:${PORT}/api/chat`);
    console.log(`👉 WebSocket 聊天: ws://localhost:${PORT}/ws`);
    console.log(`👉 WebSocket 聊天示例: http://localhost:${PORT}/websocket-chat`);
    console.log(`👉 MCP API: http://localhost:${PORT}/api/mcp`);
    console.log(`👉 用户 API: http://localhost:${PORT}/api/users`);
  });

  // 处理进程退出
  setupShutdownHandlers(server);
}

// 设置关闭处理程序
function setupShutdownHandlers(server: http.Server) {
  // 处理进程退出信号
  process.on('SIGTERM', () => gracefulShutdown(server));
  process.on('SIGINT', () => gracefulShutdown(server));
  
  // 优雅退出
  async function gracefulShutdown(server: http.Server) {
    console.log('🛑 接收到退出信号，正在优雅关闭服务...');
    
    // 关闭HTTP服务器
    server.close(() => {
      console.log('HTTP服务器已关闭');
    });
    
    // 关闭WebSocket服务器
    try {
      await closeChatWebSocket();
      console.log('WebSocket服务已关闭');
    } catch (error) {
      console.error('关闭WebSocket服务时出错:', error);
    }
    
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