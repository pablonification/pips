// The CI steps the review re-runs (e2e/scripts/lib/review/ci.mjs): only the check job's steps after "Production
// build", never another job's (F1 part 2: the first checks run tried the Docker and e2e jobs' steps too).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ciStepsAfterBuild } from '../e2e/scripts/lib/review/ci.mjs';

const YAML = `jobs:
  check:
    steps:
      - name: Production build
        run: pnpm build
      # A comment.
      - name: Production bundle
        run: node verify.mjs dist
      - name: Budgets
        run: BUDGETS_STRICT=0 pnpm --filter web budgets

  docker:
    steps:
      - name: Build the web image
        run: docker build .
      - name: Serves
        run: |
          curl it
`;

test('the steps after Production build, in its job only', () => {
  assert.deepEqual(ciStepsAfterBuild(YAML), [
    { name: 'Production bundle', run: 'node verify.mjs dist' },
    { name: 'Budgets', run: 'BUDGETS_STRICT=0 pnpm --filter web budgets' },
  ]);
  assert.deepEqual(ciStepsAfterBuild('jobs:\n  x:\n'), []);
});

test('on the real check.yml: no Docker, no e2e shard, no browser install', () => {
  const file = path.resolve(
    import.meta.dirname,
    '../../../.github/workflows/check.yml',
  );
  const steps = ciStepsAfterBuild(readFileSync(file, 'utf8'));
  assert.ok(steps.length >= 1);
  for (const s of steps)
    assert.doesNotMatch(s.run, /docker|--shard|playwright install|\$\{\{/);
});
