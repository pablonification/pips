import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { z } from 'zod';
import {
  kalenderSearchSchema,
  querySearchSchema,
} from '../src/lib/search-params';

test('Kalender keeps the chosen day and open event in the URL', () => {
  assert.deepEqual(
    kalenderSearchSchema.parse({ hari: '2026-10-08', acara: 'e1' }),
    {
      hari: '2026-10-08',
      acara: 'e1',
    },
  );
  assert.deepEqual(kalenderSearchSchema.parse({}), {});
});

// Keys left undefined don't reach the URL.
const defined = (value: object) => JSON.parse(JSON.stringify(value));

test('a bad value is dropped, never an error page', () => {
  assert.deepEqual(
    defined(kalenderSearchSchema.parse({ hari: '8 Oktober', acara: '' })),
    {},
  );
  assert.deepEqual(
    defined(kalenderSearchSchema.parse({ hari: '2026-13-45' })),
    {},
  );
  assert.deepEqual(defined(kalenderSearchSchema.parse({ hari: 20261008 })), {});
  assert.deepEqual(defined(querySearchSchema.parse({ q: 123 })), {});
  assert.deepEqual(defined(querySearchSchema.parse({ q: 'nadia' })), {
    q: 'nadia',
  });
});

test('a redirected old link with a bad value opens the page, never an error page', async () => {
  // Review m4: `/timeline?unread=1` (a number, not true) or `?sort=…` with an object made validateSearch throw.
  const schemas = await import('../src/lib/search-params');
  assert.deepEqual(
    defined(
      schemas.pengumumanSearchSchema.parse({
        unread: 1,
        sort: { a: 1 },
        excludeCategories: 'akademik',
        search: 5,
      }),
    ),
    {},
  );
  assert.deepEqual(
    schemas.pengumumanSearchSchema.parse({
      search: 'kuis',
      unread: true,
      excludeCategories: ['akademik'],
      sort: 'oldest',
    }),
    {
      search: 'kuis',
      unread: true,
      excludeCategories: ['akademik'],
      sort: 'oldest',
    },
  );
  assert.deepEqual(defined(schemas.testiSearchSchema.parse({ page: 'x' })), {});
  assert.deepEqual(schemas.testiSearchSchema.parse({ page: 2 }), { page: 2 });
  assert.deepEqual(
    defined(schemas.appSearchSchema.parse({ showAnnounce: 'yes' })),
    {},
  );
  assert.deepEqual(
    defined(
      schemas.kalenderRouteSearchSchema.parse({
        selectedDate: 'x',
        selectedMonth: {},
        selectedYear: [2026],
      }),
    ),
    {},
  );
  assert.deepEqual(
    schemas.kalenderRouteSearchSchema.parse({
      selectedDate: 8,
      selectedMonth: 9,
      selectedYear: 2026,
    }),
    { selectedDate: 8, selectedMonth: 9, selectedYear: 2026 },
  );
});

test('no route search schema throws, whatever the URL holds', async () => {
  const schemas = await import('../src/lib/search-params');
  const garbage = [{}, [], 'x', 0, -1, true, null, { a: { b: 1 } }];
  for (const [name, schema] of Object.entries(schemas)) {
    if (!(schema instanceof z.ZodObject)) continue;
    const keys = Object.keys(schema.shape);
    for (const value of garbage) {
      const search = Object.fromEntries(keys.map((key) => [key, value]));
      assert.doesNotThrow(
        () => schema.parse(search),
        `${name} with ${JSON.stringify(value)}`,
      );
    }
  }
});
