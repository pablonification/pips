import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  drizzle,
  type PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js';
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
  logger: env.NODE_ENV !== 'production',
});
// Not `typeof db`: since drizzle-orm 0.45 that type carries `$client`, which a transaction does not have. The base
// class accepts both the database and a transaction.
export type Database = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

/** Closes the pool at shutdown: queries already running get `timeoutSeconds` to finish. */
export async function closeDatabase(timeoutSeconds = 5) {
  await client.end({ timeout: timeoutSeconds });
}
