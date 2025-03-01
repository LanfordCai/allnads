import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../config/database';
import { resolve } from 'path';
import fs from 'fs';

async function runMigrations() {
  console.log('开始运行数据库迁移...');
  
  // 使用drizzle目录作为迁移文件夹
  const migrationsFolder = resolve(process.cwd(), 'drizzle');
  console.log(`迁移文件夹路径: ${migrationsFolder}`);
  
  // 检查该目录是否存在
  if (!fs.existsSync(migrationsFolder)) {
    console.error(`迁移文件夹不存在: ${migrationsFolder}`);
    console.error('请先运行 npm run db:generate 生成迁移文件');
    process.exit(1);
  }
  
  // 检查是否有迁移文件
  const files = fs.readdirSync(migrationsFolder).filter(f => f.endsWith('.sql'));
  if (files.length === 0) {
    console.error('没有找到SQL迁移文件');
    console.error('请先运行 npm run db:generate 生成迁移文件');
    process.exit(1);
  }
  
  console.log(`找到 ${files.length} 个迁移文件：`);
  files.forEach(file => console.log(`- ${file}`));
  
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