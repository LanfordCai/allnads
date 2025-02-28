import { db } from '../config/database';
import { up } from '../migrations/20231210_add_privy_user_id';

async function runMigrations() {
  try {
    console.log('开始运行数据库迁移...');
    
    // 运行迁移
    await up();
    
    console.log('数据库迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  }
}

runMigrations(); 