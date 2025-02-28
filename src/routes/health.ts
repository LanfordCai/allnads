import express from 'express';
import { env } from '../config/env';

const router = express.Router();

// GET /api/health - Health check endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRouter }; 