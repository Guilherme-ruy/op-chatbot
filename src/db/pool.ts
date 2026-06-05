import { Pool } from 'pg';
import { config } from '../config';

/**
 * Pool PostgreSQL compartilhado entre database.ts e adminDatabase.ts.
 * Criado uma única vez no processo.
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});
