// Form drafts open IndexedDB with no time limit; where it never answers (an old WebKit
// bug) a form stayed on its skeleton waiting for its draft. Past the limit a read is no draft and a write says it
// wasn't saved. An IndexedDB whose open never answers stands in for the bug.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('IndexedDB that never answers: no draft, not saved, and nothing waits for good', async (t) => {
  let opens = 0;
  (globalThis as { indexedDB?: unknown }).indexedDB = {
    open: () => {
      opens++;
      return {}; // onsuccess / onerror never called
    },
  };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { readDraft, writeDraft, deleteAllDrafts, DRAFT_TIME_LIMIT_MS } =
    await import('../src/lib/form/draft-store');
  assert.ok(DRAFT_TIME_LIMIT_MS >= 1000 && DRAFT_TIME_LIMIT_MS <= 5000);
  const settled: Record<string, unknown> = {};
  void readDraft('hmif-form-pixel', 14 * 24).then((v) => (settled.read = v));
  void writeDraft('hmif-form-pixel', { q1: 'a' }).then(
    (v) => (settled.write = v),
  );
  void deleteAllDrafts().then(() => (settled.cleared = true));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(settled, {});
  t.mock.timers.tick(DRAFT_TIME_LIMIT_MS);
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  assert.deepEqual(settled, { read: null, write: false, cleared: true });
  assert.ok(opens >= 1);
});
