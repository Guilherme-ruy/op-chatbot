/**
 * Auto-migration — executado automaticamente na inicialização do servidor.
 *
 * Roda schema.sql + admin_migration.sql contra o banco.
 * Todos os statements usam IF NOT EXISTS / ON CONFLICT, portanto
 * são 100% idempotentes: rodar múltiplas vezes não causa efeitos colaterais.
 *
 * NÃO cria o usuário admin — isso é feito uma única vez via:
 *   npm run db:admin-migrate
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './pool';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('⏳ Verificando banco de dados...');

    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schema);

    const adminSchema = readFileSync(join(__dirname, 'admin_migration.sql'), 'utf-8');
    await client.query(adminSchema);

    console.log('✅ Banco de dados atualizado.');
  } catch (err) {
    console.error('❌ Falha nas migrations — servidor não pode iniciar:', err);
    throw err;
  } finally {
    client.release();
  }
}
