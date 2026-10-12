import { strict as assert } from 'node:assert';
import { test } from 'node:test';
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
