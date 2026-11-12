// When Umumkan ulang unlocks (features/pengumuman/rules.ts), against the API's own default wait.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DEFAULT_RENOTIFY_HOURS } from '../../api/src/lib/renotify';
import { RENOTIFY_HOURS } from '../src/features/pengumuman/rules';

test("the app waits as long as the API before Umumkan ulang unlocks: three hours, as the app's words say", () => {
  assert.equal(RENOTIFY_HOURS, DEFAULT_RENOTIFY_HOURS);
  assert.equal(RENOTIFY_HOURS, 3);
});
