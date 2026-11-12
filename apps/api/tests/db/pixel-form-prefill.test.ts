// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
//
// The PIXEL form in production was created before questions could say what to prefill. Migration 0030 marks its
// name and NIM questions, and touches no other question and no other form.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';

const url = process.env.TEST_DATABASE_URL;
const MIGRATION = path.resolve(
  import.meta.dirname,
  '../../drizzle/0030_pixel_form_prefill.sql',
);

function throwawayUrl(): string {
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required: a throwaway local database named pips_test*',
    );
  }
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (
    !name.startsWith('pips_test') ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname)
  ) {
    throw new Error(
      'TEST_DATABASE_URL must be a local database named pips_test*',
    );
  }
  return url;
}

type Sections = import('../../src/db/schema').FormSection[];

let client: import('postgres').Sql;
let withoutPrefill: Sections;

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { inArray } = await import('drizzle-orm');
  const schema = await import('../../src/db/schema');
  const { PIXEL_FORM_SLUG, pixelFormSections } =
    await import('../../src/db/seed/pixel-form-seed');
  client = postgres(testUrl, { max: 2, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });

  // The form as production has it: every question, none with a prefill key.
  withoutPrefill = pixelFormSections.map((s) => ({
    ...s,
    questions: s.questions.map(({ prefill: _prefill, ...q }) => q),
  }));
  const slugs = [PIXEL_FORM_SLUG, 'pf-another-form'];
  await db.delete(schema.forms).where(inArray(schema.forms.slug, slugs));
  await db.insert(schema.forms).values(
    slugs.map((slug) => ({
      slug,
      title: slug,
      sections: withoutPrefill,
      opensAt: new Date(Date.UTC(2025, 7, 1)),
    })),
  );
});

after(async () => {
  await client?.end();
});

async function runMigration() {
  const statements = readFileSync(MIGRATION, 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
  assert.ok(statements.length > 0, 'the migration has SQL');
  for (const statement of statements) await client.unsafe(statement);
}

async function sectionsOf(slug: string): Promise<Sections> {
  const [row] = await client<{ sections: Sections }[]>`
    select sections::text::jsonb as sections from forms where slug = ${slug}`;
  return row.sections;
}

test('the PIXEL form prefills name and NIM, every question kept in order, and nothing else changes', async () => {
  const { PIXEL_FORM_SLUG, pixelFormSections } =
    await import('../../src/db/seed/pixel-form-seed');
  for (let run = 1; run <= 2; run += 1) {
    await runMigration();
    assert.deepEqual(
      await sectionsOf(PIXEL_FORM_SLUG),
      pixelFormSections,
      `run ${run}`,
    );
    assert.deepEqual(
      await sectionsOf('pf-another-form'),
      withoutPrefill,
      `run ${run}`,
    );
  }
  const marked = (await sectionsOf(PIXEL_FORM_SLUG))
    .flatMap((s) => s.questions)
    .filter((q) => q.prefill)
    .map((q) => [q.id, q.prefill]);
  assert.deepEqual(marked, [
    ['q1', 'fullName'],
    ['q2', 'nim'],
  ]);
});
