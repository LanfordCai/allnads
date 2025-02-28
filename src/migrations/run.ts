import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../config/database';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsFolder = resolve(__dirname, '.');

// 运行迁移
async function runMigrations() {
  console.log('开始运行数据库迁移...');
  console.log(`迁移文件夹路径: ${migrationsFolder}`);
  
  try {
    // 执行所有迁移文件
    await migrate(db, { migrationsFolder });
    console.log('数据库迁移成功完成 ✅');
  } catch (error) {
    console.error('数据库迁移失败 ❌:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 执行迁移
runMigrations(); 