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
import { SessionService } from './services/sessionService';
import { closeDatabase } from './config/database';
import { initializeChatWebSocket, closeChatWebSocket } from './routes/chatSocket';
import { requestLogger } from './middleware/logger';
import { Logger } from './utils/logger';
import { blockchainService } from './services/blockchainService';

// ES Modules compatibility: Get equivalent value for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express application
const app = express();
const server = http.createServer(app);

// Define function to shut down the application
function setupShutdownHandlers(server: http.Server) {
  const shutdown = async () => {
    console.log('Server is shutting down...');
    server.close(() => {
      console.log('HTTP server closed');
    });
    
    // Close WebSocket connections
    closeChatWebSocket();
    // Close database connections
    await closeDatabase();
    
    console.log('Application safely closed');
    process.exit(0);
  };

  // Register process event handlers
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown();
  });
}

// Initialize services
async function initializeServer(): Promise<void> {
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Request logging middleware - add before all other middleware
  app.use(requestLogger);
  
  // API routes - register routes after adding logging middleware
  app.use('/api/health', healthRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/mcp', mcpRouter);
  app.use('/api/users', userRouter);
  app.use('/api/nft', nftRouter);
  
  // Static files
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Handle 404 and errors
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Initialize WebSocket chat service
  Logger.info('Server', 'Initializing WebSocket chat service...');
  initializeChatWebSocket(server);
  Logger.info('Server', 'WebSocket chat service initialized');

  // Initialize MCP server connections
  Logger.info('Server', 'Connecting to MCP servers...');
  try {
    const success = await initializeMCPServers();
    if (success) {
      Logger.info('Server', 'MCP servers connected successfully');
    } else {
      Logger.warn('Server', 'Some MCP servers failed to connect, some features may be unavailable');
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('Server', `Failed to connect to MCP servers: ${errorMessage}`, err);
    Logger.warn('Server', 'The system will run without MCP support, tool call functionality will be unavailable');
  }

  // Initialize NFT template cache
  Logger.info('Server', 'Initializing NFT template cache...');
  try {
    await blockchainService.initializeTemplateCache();
    Logger.info('Server', 'NFT template cache initialized successfully');
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('Server', `Failed to initialize NFT template cache: ${errorMessage}`, err);
    Logger.warn('Server', 'The system will run without template cache, template queries may be slow');
  }

  // Load all sessions
  Logger.info('Server', 'Loading chat session data...');
  try {
    await SessionService.loadAllSessions();
    Logger.info('Server', 'Chat session data loaded successfully');
  } catch (error) {
    Logger.error('Server', 'Failed to load chat session data', error);
    Logger.warn('Server', 'The system will start with empty session data');
  }

  // Start server (use http.Server instead of app)
  const PORT = parseInt(env.PORT, 10);
  server.listen(PORT, '::', () => {
    Logger.info('Server', `Server started on port ${PORT}, mode: ${env.NODE_ENV}`);
    Logger.info('Server', `Health check: http://localhost:${PORT}/api/health`);
    Logger.info('Server', `Chat API: http://localhost:${PORT}/api/chat`);
    Logger.info('Server', `WebSocket chat: ws://localhost:${PORT}/ws`);
    Logger.info('Server', `MCP API: http://localhost:${PORT}/api/mcp`);
    Logger.info('Server', `User API: http://localhost:${PORT}/api/users`);
  });

  // Handle process exit
  setupShutdownHandlers(server);
}

// Start server
initializeServer().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  Logger.error('Server', `Failed to start server: ${errorMessage}`, err);
  process.exit(1);
}); 