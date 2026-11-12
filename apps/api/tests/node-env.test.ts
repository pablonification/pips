import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DefaultLogger } from 'drizzle-orm';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

// With NODE_ENV unset the settings count it as production, and so must every part of the API.
usePlaceholderEnv();
delete process.env.NODE_ENV;

test('with NODE_ENV unset, statements and their values are not logged', async () => {
  const { db } = await import('../src/db/drizzle');
  const logger = (db as unknown as { session: { logger: unknown } }).session
    .logger;
  assert.equal(logger instanceof DefaultLogger, false);
});

test('with NODE_ENV unset, the reminder job runs', async () => {
  const { setupCron } = await import('../src/cron/setup');
  const { calendarCron } = await import('../src/cron/calendar-cron');
  try {
    setupCron();
    assert.equal(calendarCron.running, true);
  } finally {
    calendarCron.stop();
  }
});
