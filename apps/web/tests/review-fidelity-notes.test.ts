// F1's hand-checked fidelity notes (e2e/review/fidelity-notes.ts): each names real locked screens, once each, with a
// reason and where it comes from.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FIDELITY_NOTES, noteFor } from '../e2e/review/fidelity-notes';

test('every note names locked screens the fidelity tool knows, each screen in one note only', async () => {
  // names.mjs has no types of its own: read it as plain data.
  const namesFile: string = '../e2e/fidelity/names.mjs';
  const { EXTRA_SCREENS, screenNames } = (await import(namesFile)) as {
    EXTRA_SCREENS: { name: string }[];
    screenNames: () => { name: string }[];
  };
  const known = new Set([
    ...screenNames().map((s) => s.name),
    ...EXTRA_SCREENS.map((e) => e.name),
  ]);
  const seen = new Set<string>();
  for (const n of FIDELITY_NOTES)
    for (const name of n.screens) {
      assert.ok(known.has(name), `not a locked screen: ${name}`);
      assert.ok(!seen.has(name), `in two notes: ${name}`);
      seen.add(name);
    }
});

test('every note has a reason and a source; noteFor finds a screen’s note', () => {
  for (const n of FIDELITY_NOTES) {
    assert.ok(n.reason.length > 20, n.screens[0]);
    assert.ok(n.source.length > 3, n.screens[0]);
  }
  assert.match(noteFor('i-push-dialog')!.reason, /Form berhasil dikirim!/);
  assert.equal(noteFor('desk-anggota-beranda-light'), null);
});
