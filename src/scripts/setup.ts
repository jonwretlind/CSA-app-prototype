import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runSqlFile(conn: mysql.Connection, filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf8');
  // Split on semicolons, skip comments and empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

  // Use query() (not execute) — DDL statements are not supported via prepared statements
  for (const stmt of statements) {
    await conn.query(stmt);
  }
}

async function setup(): Promise<void> {
  console.log('\n========================================');
  console.log('  CSA App — Database Setup');
  console.log('========================================\n');

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306');
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'csa_app';

  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: false });

  try {
    // Create database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);
    console.log(`✓ Database '${dbName}' ready`);

    // Run schema
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    await runSqlFile(conn, schemaPath);
    console.log('✓ Schema applied');

    // Run seed
    const seedPath = path.join(__dirname, '../../database/seed.sql');
    await runSqlFile(conn, seedPath);
    console.log('✓ Gift categories seeded');

    // Create superadmin
    console.log('\n--- Create Super Admin Account ---');
    const adminEmail = (await prompt('Email   [admin@csa.local]: ')) || 'admin@csa.local';
    const adminFirst = (await prompt('First   [Admin]: '))            || 'Admin';
    const adminLast  = (await prompt('Last    [User]: '))             || 'User';
    const adminPass  = (await prompt('Password [Admin@123!]: '))      || 'Admin@123!';

    const hash = await bcrypt.hash(adminPass, 12);
    await conn.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES (?, ?, ?, ?, 'superadmin')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'superadmin'`,
      [adminEmail, hash, adminFirst, adminLast]
    );

    console.log('\n✓ Setup complete!');
    console.log(`  Super admin : ${adminEmail}`);
    console.log('\nNext steps:');
    console.log('  1. Copy .env.example to .env and verify settings');
    console.log('  2. npm run dev');
    console.log('  3. Open http://localhost:3000\n');
  } finally {
    conn.end();
  }
}

setup().catch(err => {
  console.error('\n✗ Setup failed:', err.message || err);
  process.exit(1);
});
