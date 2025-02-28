import { pool, db } from '../config/database';
import { sessions, messages } from '../models/schema';
import { sql } from 'drizzle-orm';

async function createTables() {
  console.log('正在创建数据库表...');
  
  try {
    // 创建session表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('创建sessions表成功 ✅');
    
    // 创建messages表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);
    console.log('创建messages表成功 ✅');
    
    // 在messages表上创建索引以提高查询性能
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);
    console.log('创建索引成功 ✅');
    
    console.log('所有数据库表创建成功！');
  } catch (error) {
    console.error('创建数据库表失败:', error);
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 执行创建表操作
createTables(); 