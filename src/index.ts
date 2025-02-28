import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { chatRouter } from './routes/chat';
import { notFoundHandler, errorHandler } from './middleware/error';

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/chat', chatRouter);

// 404 处理中间件
app.use(notFoundHandler);

// 异常处理中间件
app.use(errorHandler);

// Start server
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${env.NODE_ENV} mode`);
  console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👉 Chat API: http://localhost:${PORT}/api/chat`);
}); 