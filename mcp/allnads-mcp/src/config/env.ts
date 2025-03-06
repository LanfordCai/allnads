import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Define environment variables schema
const envSchema = z.object({
  PORT: z.string().default("8080"),

  MONAD_TESTNET_RPC: z.string().url(),
  MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  MONAD_TESTNET_ALLNADS_ACCOUNT_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  
  // API URL for template fetching
  ALLNADS_SERVER_API_URL: z.string().url(),
});

// Validate environment variables
try {
  envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Export typed environment variables
export const env = envSchema.parse(process.env); 