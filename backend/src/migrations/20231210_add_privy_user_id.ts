import { sql } from 'drizzle-orm';
import { db } from '../config/database';

/**
 * 添加 Privy 用户 ID 到会话表
 */
export async function up() {
  console.log('运行迁移: 添加 Privy 用户 ID 到会话表');
  
  try {
    // 添加 privy_user_id 列到 sessions 表
    await db.execute(sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS privy_user_id VARCHAR(255)`);
    
    // 创建索引以提高查询性能
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(privy_user_id)`);
    
    // 创建用户引用表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_references (
        id SERIAL PRIMARY KEY,
        privy_user_id VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255),
        email VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMP,
        metadata JSONB
      )
    `);
    
    console.log('迁移完成: 成功添加 Privy 用户 ID 到会话表');
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  }
}

/**
 * 回滚迁移
 */
export async function down() {
  console.log('回滚迁移: 移除 Privy 用户 ID');
  
  try {
    // 删除索引
    await db.execute(sql`DROP INDEX IF EXISTS idx_sessions_user_id`);
    
    // 从 sessions 表中删除 privy_user_id 列
    await db.execute(sql`ALTER TABLE sessions DROP COLUMN IF EXISTS privy_user_id`);
    
    // 删除用户引用表
    await db.execute(sql`DROP TABLE IF EXISTS user_references`);
    
    console.log('回滚完成: 成功移除 Privy 用户 ID');
  } catch (error) {
    console.error('回滚失败:', error);
    throw error;
  }
} 