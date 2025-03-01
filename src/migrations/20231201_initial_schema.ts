import { sql } from 'drizzle-orm';
import { db, pool } from '../config/database';

export async function up() {
  console.log('创建初始数据库表结构...');
  
  try {
    // 创建会话表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY NOT NULL,
        privy_user_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ 创建 sessions 表成功');

    // 创建消息表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_session_id
          FOREIGN KEY (session_id)
          REFERENCES sessions(id)
          ON DELETE CASCADE
      );
    `);
    console.log('✅ 创建 messages 表成功');
    
    // 创建索引提高查询性能
    await db.execute(sql`
      CREATE INDEX idx_messages_session_id ON messages(session_id);
    `);
    console.log('✅ 创建消息表索引成功');

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
      );
    `);
    console.log('✅ 创建 user_references 表成功');

    console.log('初始数据库表结构创建完成 ✅');
  } catch (error) {
    console.error('创建表失败:', error);
    throw error;
  }
}

export async function down() {
  console.log('回滚初始数据库表结构...');
  
  try {
    // 删除表 (以相反的顺序删除，先删除引用表)
    await db.execute(sql`DROP TABLE IF EXISTS messages;`);
    await db.execute(sql`DROP TABLE IF EXISTS user_references;`);
    await db.execute(sql`DROP TABLE IF EXISTS sessions;`);
    
    console.log('初始数据库表结构回滚完成 ✅');
  } catch (error) {
    console.error('回滚表失败:', error);
    throw error;
  }
} 