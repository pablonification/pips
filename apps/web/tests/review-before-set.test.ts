// The before set's 52 states (e2e/review/before-set-ids.json, committed so CI can run this): each has an entry in
// e2e/capture/states.ts or a reason it was removed, and a flow that shows it. Checked against the before set's own
// manifest.json when the workspace is around this checkout.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { STATES } from '../e2e/capture/states';
import { FLOWS } from '../e2e/review/flows';
import { REMOVED, STATE_FLOWS } from '../e2e/scripts/lib/review/data.mjs';

const ids: string[] = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '..', 'e2e', 'review', 'before-set-ids.json'), 'utf8'),
);

test('52 states, each captured again or removed by design with a reason', () => {
  assert.equal(ids.length, 52);
  const captured = new Set(STATES.map((s) => s.id));
  for (const id of ids) assert.ok(captured.has(id) || REMOVED[id], id);
});

test('each state is shown by flows that exist', () => {
  const flows = new Set(FLOWS.map((f) => f.id));
  for (const id of ids) {
    assert.ok(STATE_FLOWS[id]?.length, `${id}: no flow`);
    for (const f of STATE_FLOWS[id]) assert.ok(flows.has(f), `${id}: ${f}`);
  }
});

test('the list is the before set’s own (when the workspace is there)', () => {
  const manifest = path.resolve(import.meta.dirname, '..', '..', '..', '..', '..', 'ops', 'redesign', 'before-set', 'manifest.json');
  if (!existsSync(manifest)) return;
  const m = JSON.parse(readFileSync(manifest, 'utf8')) as { states: { id: string }[] };
  assert.deepEqual(m.states.map((s) => s.id).sort(), [...ids].sort());
});
