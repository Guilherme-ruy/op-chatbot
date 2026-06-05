/**
 * Executa o schema.sql no banco e gera tokens para os sites seed.
 * Uso: npm run db:migrate
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function generateToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('hex')}`;
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('⏳ Aplicando schema...');
    const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

    // Substitui placeholders por tokens reais antes de executar
    const tokenExample = generateToken('chatbot');
    const finalSql = sql
      .replace('REPLACE_TOKEN_EXAMPLE', tokenExample);

    await client.query(finalSql);

    console.log('\n✅ Schema aplicado com sucesso!\n');
    console.log('─────────────────────────────────────────');
    console.log('Token gerado para o site de exemplo:');
    console.log('');
    console.log(`example.com → data-token="${tokenExample}"`);
    console.log('');
    console.log('Adicione mais sites pelo painel admin.');
    console.log('─────────────────────────────────────────\n');
  } catch (err) {
    console.error('❌ Erro na migração:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
