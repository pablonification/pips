import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '~/configs/env.config';
import * as schema from './schema';

/**
 * Connection settings: every statement is cancelled after `DB_STATEMENT_TIMEOUT_MS` (15 s unless set; 0 turns it
 * off), so a stuck query gives an error instead of holding a pooled connection for good.
 */
export function postgresOptions(config: { DB_STATEMENT_TIMEOUT_MS: number }) {
  return {
    connection: { statement_timeout: config.DB_STATEMENT_TIMEOUT_MS },
  };
}

const client = postgres(env.DATABASE_URL, postgresOptions(env));

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV !== 'production',
});
export type Database = typeof db;

/** Closes the pool at shutdown: queries already running get `timeoutSeconds` to finish. */
export async function closeDatabase(timeoutSeconds = 5) {
  await client.end({ timeout: timeoutSeconds });
}
