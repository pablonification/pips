// F1's story coverage (e2e/review/coverage.ts): exactly one row per SPEC story 1–157; every flow and check it names
// exists; a story is "shown" only with a flow, "checked" only with a check, and "not built" or "out of scope" with a
// reason and its source.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CHECKS, COVERAGE } from '../e2e/review/coverage';
import { FLOWS } from '../e2e/review/flows';

test('one row for each story, 1 to 157, in order', () => {
  assert.deepEqual(
    COVERAGE.map((r) => r.story),
    Array.from({ length: 157 }, (_, i) => i + 1),
  );
});

test('every flow and check named exists', () => {
  const flows = new Set(FLOWS.map((f) => f.id));
  for (const r of COVERAGE) {
    for (const f of r.flows) assert.ok(flows.has(f), `story ${r.story}: flow ${f}`);
    for (const c of r.checks) assert.ok(c in CHECKS, `story ${r.story}: check ${c}`);
  }
});

test('each status has what it needs, and no story is left without a flow, a check or a reason', () => {
  for (const r of COVERAGE) {
    if (r.status === 'shown') assert.ok(r.flows.length, `story ${r.story}`);
    if (r.status === 'checked') assert.ok(r.checks.length, `story ${r.story}`);
    if (r.status === 'not built' || r.status === 'out of scope') {
      assert.ok(r.reason && r.reason.length > 10, `story ${r.story}`);
      assert.equal(r.flows.length, 0, `story ${r.story}: no flow for what isn't built`);
    }
    assert.ok(!r.reason?.startsWith('No flow shows it'), `story ${r.story} has nothing showing it`);
  }
});

test('the stories SPEC has, as numbered there (when the workspace is around this checkout)', () => {
  const spec = path.resolve(import.meta.dirname, '..', '..', '..', '..', '..', 'ops', 'ui-revamp-review', 'SPEC.md');
  if (!existsSync(spec)) return;
  const stories = [...readFileSync(spec, 'utf8').matchAll(/^(\d{1,3})\. As /gm)].map((m) => Number(m[1]));
  assert.deepEqual(stories, Array.from({ length: 157 }, (_, i) => i + 1));
});
