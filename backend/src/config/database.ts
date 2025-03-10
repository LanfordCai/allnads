import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env';

const { Pool } = pg;

// Create PostgreSQL connection pool
const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: parseInt(env.POSTGRES_PORT),
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  // Connection pool configuration
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create Drizzle ORM instance
export const db = drizzle(pool);

// Export the pool for connection closing
export { pool };

// For cleaning up resources when the application shuts down
export async function closeDatabase() {
  console.log('Closing database connection...');
  await pool.end();
  console.log('Database connection closed');
} 