import * as Sentry from '@sentry/node';
import { logger } from '~/logger';

/**
 * What a client is told when the database refuses a write: a fixed sentence. The database's own message (table,
 * column and constraint names, values) goes to the log and Sentry only.
 */
export function databaseError(err: unknown) {
  logger.error({
    type: 'database',
    message: err instanceof Error ? err.message : String(err),
    code: (err as { code?: string } | null)?.code,
  });
  Sentry.captureException(err);
  return { error: 'Invalid request' };
}
