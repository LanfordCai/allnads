import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

export default {
  schema: "./src/models/schema.ts",
  out: "./src/migrations",
  driver: "pg" as const,
  dbCredentials: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'wenads_agent',
  },
} satisfies Config; 