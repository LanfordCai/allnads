import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../config/database';
import { resolve } from 'path';
import fs from 'fs';

async function runMigrations() {
  console.log('Starting database migrations...');
  
  const migrationsFolder = resolve(process.cwd(), 'drizzle');
  console.log(`Migration folder path: ${migrationsFolder}`);
  
  if (!fs.existsSync(migrationsFolder)) {
    console.error(`Migration folder does not exist: ${migrationsFolder}`);
    console.error('Please run npm run db:generate to generate migration files first');
    process.exit(1);
  }
  
  const files = fs.readdirSync(migrationsFolder).filter(f => f.endsWith('.sql'));
  if (files.length === 0) {
    console.error('No SQL migration files found');
    console.error('Please run npm run db:generate to generate migration files first');
    process.exit(1);
  }
  
  console.log(`Found ${files.length} migration files:`);
  files.forEach(file => console.log(`- ${file}`));
  
  try {
    await migrate(db, { migrationsFolder });
    console.log('Database migrations completed successfully ✅');
  } catch (error) {
    console.error('Database migrations failed ❌:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations(); 