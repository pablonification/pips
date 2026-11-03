import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

/*
 * Ubah lomba can change only the poster: `PUT /competitions/{id}` with just `mediaUrls` (a new list, or `[]` to remove
 * it). `mediaUrls` isn't a column, so the update used to build `update "competitions" set  where …`, which Postgres
 * refuses (answered 400). The row is now read as it is, and only the posters change.
 */

before(async () => {
  usePlaceholderEnv();
  // The schemas call `.openapi()`, which zod has once the routes load (as in the running app).
  await import('../src/routes/competitions.route');
});

const POSTER =
  'https://pub-45e54d5755814b02b87e024df83efb57.r2.dev/r176r3qcuqs3hg8o3dm93n35-hology.png';

test('regression: only the poster changes: the row is read, not updated with nothing to set', async () => {
  const { db } = await import('../src/db/drizzle');
  const { competitionRowQuery } =
    await import('../src/repositories/competitions.repo');
  for (const mediaUrls of [[POSTER], []]) {
    const { sql } = competitionRowQuery(db, 'lomba-1', { mediaUrls }).toSQL();
    assert.match(sql, /^select /);
    assert.doesNotMatch(sql, /update/);
    assert.match(sql, /where "competitions"\."id" = \$1$/);
  }
});

test('other fields with a poster: only the columns are set', async () => {
  const { db } = await import('../src/db/drizzle');
  const { competitionRowQuery } =
    await import('../src/repositories/competitions.repo');
  const { sql, params } = competitionRowQuery(db, 'lomba-1', {
    name: 'Hology 8',
    mediaUrls: [POSTER],
  }).toSQL();
  assert.match(sql, /^update "competitions" set "name" = \$1 where /);
  assert.doesNotMatch(sql, /media/i);
  assert.deepEqual(params, ['Hology 8', 'lomba-1']);
});
