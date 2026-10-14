// The review package's size budget (e2e/scripts/lib/review/budget.mjs): the budget from the day's free space, the
// sums per part, the projection from a pilot, and the order recordings are added in, raising the CRF before stopping.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUDGET,
  GiB,
  MiB,
  PARTS,
  fromPilot,
  otherParts,
  packageBudget,
  planRecordings,
  projectBytes,
} from '../e2e/scripts/lib/review/budget.mjs';

test('the budget is free − 1 GiB floor − 250 MiB peak − 100 MiB margin, capped at 300 MiB, never negative', () => {
  assert.equal(
    packageBudget(1.5 * GiB),
    1.5 * GiB - GiB - 250 * MiB - 100 * MiB,
  );
  assert.equal(packageBudget(10 * GiB), 300 * MiB);
  assert.equal(packageBudget(1 * GiB), 0);
  assert.equal(BUDGET.minimum, 210 * MiB);
});

test('the media the package already holds counts as free, not against the budget (F1 part 2)', () => {
  // 1.5 GiB free with 110 MiB recorded is the same day as 1.61 GiB free before recording.
  assert.equal(
    packageBudget(1.5 * GiB, 110 * MiB),
    packageBudget(1.5 * GiB + 110 * MiB),
  );
  // The bug: re-planning with only the free space dropped under the 210 MiB minimum.
  assert.ok(packageBudget(1.5 * GiB) < BUDGET.minimum);
  assert.ok(packageBudget(1.5 * GiB, 110 * MiB) >= BUDGET.minimum);
});

test('the other parts sum to their ceilings: 40 + 25 + 10 + 5 MiB', () => {
  assert.deepEqual(
    PARTS.map((p) => p.max / MiB),
    [40, 25, 10, 5],
  );
  assert.equal(otherParts(), 80 * MiB);
});

test('the projection: seconds × KB per second per layout, smaller at a higher CRF', () => {
  const recs = [
    { layout: 'phone', seconds: 40 },
    { layout: 'desktop', seconds: 10 },
  ];
  assert.equal(
    projectBytes(recs, { phone: 15, desktop: 28 }),
    (40 * 15 + 10 * 28) * 1024,
  );
  assert.ok(
    projectBytes(recs, { phone: 15, desktop: 28 }, 34) <
      projectBytes(recs, { phone: 15, desktop: 28 }, 32),
  );
});

test('a pilot gives KB per second per layout and the mean seconds', () => {
  const p = fromPilot([
    { layout: 'phone', seconds: 30, bytes: 30 * 16 * 1024 },
    { layout: 'phone', seconds: 10, bytes: 10 * 16 * 1024 },
    { layout: 'desktop', seconds: 20, bytes: 20 * 30 * 1024 },
  ]);
  assert.equal(p.kbps.phone, 16);
  assert.equal(p.kbps.desktop, 30);
  assert.equal(p.kbps.narrow320, 16);
  assert.equal(p.secondsPerRecording, 20);
});

const rec = (n, layout = 'phone', seconds = 40) =>
  Array.from({ length: n }, () => ({ layout, seconds }));
const kbps = { phone: 15, tablet: 21, desktop: 28 };

test('the order: light for every flow, then the dark set, then dark for every flow, while they fit', () => {
  const all = planRecordings({
    budget: 300 * MiB,
    light: rec(100),
    darkSet: rec(30),
    darkRest: rec(70),
    kbps,
  });
  assert.deepEqual(all.phases, ['light', 'dark-set', 'dark-rest']);
  assert.equal(all.crf, 32);
  const lightOnly = planRecordings({
    budget: 220 * MiB,
    light: rec(200),
    darkSet: rec(100),
    darkRest: rec(100),
    kbps,
  });
  assert.deepEqual(lightOnly.phases, ['light']);
  const withSet = planRecordings({
    budget: 260 * MiB,
    light: rec(200),
    darkSet: rec(30),
    darkRest: rec(200),
    kbps,
  });
  assert.deepEqual(withSet.phases, ['light', 'dark-set']);
});

test('light that doesn’t fit at CRF 32 tries 34; still not: stop; under 210 MiB: ask Dev 1 first', () => {
  const at34 = planRecordings({
    budget: 250 * MiB,
    light: rec(320),
    darkSet: [],
    darkRest: [],
    kbps,
  });
  assert.equal(at34.ok, true);
  assert.equal(at34.crf, 34);
  const stop = planRecordings({
    budget: 250 * MiB,
    light: rec(600),
    darkSet: [],
    darkRest: [],
    kbps,
  });
  assert.equal(stop.ok, false);
  assert.match(stop.reason, /CRF 34/);
  const small = planRecordings({
    budget: 200 * MiB,
    light: rec(1),
    darkSet: [],
    darkRest: [],
    kbps,
  });
  assert.equal(small.ok, false);
  assert.match(small.reason, /free space/);
});
