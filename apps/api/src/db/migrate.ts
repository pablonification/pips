import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Brings drizzle's record of applied migrations back in step with its id counter, before migrating.
 *
 * Production's database has two migrations (0022, 0023) recorded by hand with explicit ids, so its counter is
 * behind the rows. drizzle then gives the next record an id that already exists and the migration fails with "Key
 * (id)=(23) already exists". Moving the counter to the highest id changes nothing on a database already in step.
 */
async function alignMigrationIds(sql: postgres.Sql) {
  const [table] = await sql<
    Array<{ exists: boolean }>
  >`select to_regclass('drizzle.__drizzle_migrations') is not null as exists`;
  if (!table?.exists) return;
  await sql`
    select setval(pg_get_serial_sequence('drizzle.__drizzle_migrations', 'id'), max(id))
    from drizzle.__drizzle_migrations
    having max(id) is not null`;
}

/** Applies every pending migration in `migrationsFolder` to the database at `url` (`DATABASE_URL` by default). */
export async function runMigrate({
  url = process.env.DATABASE_URL,
  migrationsFolder = './drizzle',
}: { url?: string; migrationsFolder?: string } = {}) {
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  const migrationClient = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await alignMigrationIds(migrationClient);
    await migrate(drizzle(migrationClient), { migrationsFolder });
  } finally {
    await migrationClient.end();
  }
}

if (require.main === module) {
  runMigrate().then(
    () => {
      console.log('Migrations applied');
    },
    (error: unknown) => {
      console.error('Migration failed:', error);
      process.exitCode = 1;
    },
  );
}
