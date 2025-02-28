import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { chatRouter } from './routes/chat';
import { mcpRouter } from './routes/mcp';
import { notFoundHandler, errorHandler } from './middleware/error';
import { initializeMCPServers } from './services/mcpService';

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/chat', chatRouter);
app.use('/api/mcp', mcpRouter);

// 404 处理中间件
app.use(notFoundHandler);

// 异常处理中间件
app.use(errorHandler);

// 初始化MCP服务器连接
console.log('🔌 正在连接MCP服务器...');
initializeMCPServers()
  .then((success) => {
    if (success) {
      console.log('✅ MCP服务器连接成功');
    } else {
      console.warn('⚠️ 部分MCP服务器连接失败，某些功能可能不可用');
    }
  })
  .catch(err => {
    console.error('❌ MCP服务器连接失败:', err.message);
    console.warn('⚠️ 系统将在无MCP支持的情况下运行，工具调用功能不可用');
  });

// Start server
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${env.NODE_ENV} mode`);
  console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👉 Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`👉 MCP API: http://localhost:${PORT}/api/mcp`);
}); 