/**
 * Aplica a admin_migration.sql e semeia o usuário admin inicial.
 * Uso: npm run db:admin-migrate
 *
 * Requer no .env:
 *   ADMIN_EMAIL    — e-mail do admin
 *   ADMIN_PASSWORD — senha em texto puro (usada apenas aqui para gerar o hash)
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const adminEmail    = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('❌ ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios no .env');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log('⏳ Aplicando admin_migration.sql...');
    const sql = readFileSync(join(__dirname, 'admin_migration.sql'), 'utf-8');
    await client.query(sql);
    console.log('✅ Migration aplicada.');

    console.log('⏳ Criando usuário admin...');
    const hash = await bcrypt.hash(adminPassword, 12);
    await client.query(
      `INSERT INTO admin_users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, hash]
    );
    console.log(`✅ Admin criado: ${adminEmail}`);
    console.log('\n🔐 Você pode remover ADMIN_PASSWORD do .env agora.\n');
  } catch (err) {
    console.error('❌ Erro na migration:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
