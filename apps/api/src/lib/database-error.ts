import * as Sentry from '@sentry/node';
import postgres from 'postgres';
import { logger } from '~/logger';

/**
 * Recognised by its shape, not `instanceof`: `postgres` ships a CommonJS and an ES module build, each with its own
 * `PostgresError` class, and a client made through `import()` throws the other build's class.
 */
const isDriverError = (err: unknown): err is postgres.PostgresError =>
  err instanceof Error &&
  err.name === 'PostgresError' &&
  typeof (err as { code?: unknown }).code === 'string';

/**
 * The PostgreSQL error behind `err`, if the database refused the query. drizzle-orm throws a `DrizzleQueryError`
 * ("Failed query: …", with the query's parameters) whose `cause` is the driver's own error, so checking `err` alone
 * misses every refusal and a unique or foreign-key violation answers 500.
 */
export function postgresError(
  err: unknown,
): postgres.PostgresError | undefined {
  if (isDriverError(err)) return err;
  if (err instanceof Error && isDriverError(err.cause)) return err.cause;
  return undefined;
}

/** Whether the database refused the query that threw `err` (see `postgresError`). */
export function isPostgresError(err: unknown) {
  return postgresError(err) !== undefined;
}

/**
 * What a client is told when the database refuses a write: a fixed sentence. The database's own message (table,
 * column and constraint names, values) goes to the log and Sentry only; drizzle's wrapper is left out, since its
 * message carries the query's parameters.
 */
export function databaseError(err: unknown) {
  const cause = postgresError(err) ?? err;
  logger.error({
    type: 'database',
    message: cause instanceof Error ? cause.message : String(cause),
    code: (cause as { code?: string } | null)?.code,
  });
  Sentry.captureException(cause);
  return { error: 'Invalid request' };
}
