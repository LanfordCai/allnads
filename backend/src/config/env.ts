import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Define schema for environment variables
const envSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // OpenRouter
  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_MODEL: z.string(),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // API Authentication
  SERVICE_API_KEY: z.string(),
  
  // PostgreSQL
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().default('5432'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string().default('allnads'),
  
  // Privy
  PRIVY_APP_ID: z.string(),
  PRIVY_APP_SECRET: z.string(),
  
  // Blockchain - Monad Testnet
  MONAD_TESTNET_RPC: z.string(),
  MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS: z.string(),
  MONAD_TESTNET_AIRDROPPER_CONTRACT_ADDRESS: z.string(),
  MONAD_AIRDROPPER_ADDRESS: z.string(),
  MONAD_AIRDROPPER_PRIVATE_KEY: z.string(),
});

// Parse and validate environment variables
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const env = _env.data; 