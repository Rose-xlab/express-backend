import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import config from '../config';
import { createLogger } from './logger';

const logger = createLogger('database');

if (!config.database.url || !config.database.key) {
  logger.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

// Supabase client for most operations
export const supabase = createClient(
  config.database.url,
  config.database.key
);

// Direct Postgres connection for complex queries and transactions
let pgPool: Pool | null = null;

if (config.database.pgUrl) {
  pgPool = new Pool({
    connectionString: config.database.pgUrl,
  });
}

export async function runQuery(query: string, params: any[] = []) {
  if (!pgPool) {
    throw new Error('PostgreSQL connection not configured');
  }
  
  const client = await pgPool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function executeTransaction(callback: (client: any) => Promise<void>) {
  if (!pgPool) {
    throw new Error('PostgreSQL connection not configured');
  }
  
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await callback(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function healthCheck() {
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1);
    if (error) throw error;
    
    if (pgPool) {
      const client = await pgPool.connect();
      await client.query('SELECT 1');
      client.release();
    }
    
    return true;
  } catch (error) {
    logger.error('Database health check failed', error as Error);
    return false;
  }
}

export async function closeConnections() {
  if (pgPool) {
    await pgPool.end();
  }
}