import { db, pool } from '../config/database';
import { sql } from 'drizzle-orm';

async function testConnection() {
  try {
    console.log('正在测试数据库连接...');
    
    // 测试简单查询
    const result = await db.execute(sql`SELECT NOW() as current_time`);
    
    console.log('数据库连接成功! ✅');
    console.log(`服务器时间: ${result.rows[0]?.current_time || '未知'}`);
    
    // 检查数据库中是否存在我们的表
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\n数据库中的表:');
    if (tablesResult.rows.length === 0) {
      console.log('没有找到任何表，需要运行迁移脚本创建表结构。');
    } else {
      tablesResult.rows.forEach((table: any) => {
        console.log(`- ${table.table_name}`);
      });
    }
  } catch (error) {
    console.error('数据库连接测试失败 ❌:', error);
  } finally {
    // 关闭连接池
    await pool.end();
  }
}

// 执行测试
testConnection(); 