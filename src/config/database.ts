import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env';

const { Pool } = pg;

// 创建 PostgreSQL 连接池
const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: parseInt(env.POSTGRES_PORT),
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  // 连接池配置
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 创建 Drizzle ORM 实例
export const db = drizzle(pool);

// 导出连接池以便于关闭连接
export { pool };

// 用于应用关闭时清理资源
export async function closeDatabase() {
  console.log('正在关闭数据库连接...');
  await pool.end();
  console.log('数据库连接已关闭');
} 