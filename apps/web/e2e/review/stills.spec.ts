/**
 * F1's own captures of screens with no locked target (stills.ts, `STILL_STATES`): the states no task wrote a capture
 * spec for, reached the way their journeys reach them. Runs only from `pnpm --filter web review stills`, with
 * REVIEW_STILLS_DIR set, on the review-stills-<layout>-<theme> projects; writes `<layout>-<state>-<theme>.png`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stableScreenshot } from '../support/capture';
import { expect, test } from '../support/test';
import { STILL_STATES } from './stills';

const dir = process.env.REVIEW_STILLS_DIR;
test.skip(!dir, 'Set REVIEW_STILLS_DIR to capture the stills.');

for (const s of STILL_STATES)
  test.describe(s.id, () => {
    test.use({ persona: s.persona, signedIn: s.signedIn ?? true });
    test(`${s.title} [${s.owner}]`, async ({ page, api, db }, testInfo) => {
      const m = /^review-stills-(phone|tablet|desktop)-(light|dark)$/.exec(testInfo.project.name);
      test.skip(!m, 'a review-stills project only');
      await s.setup?.({ api, db, page });
      await page.goto(s.path);
      await s.act?.(page);
      await expect(s.ready(page)).toBeVisible({ timeout: 20_000 });
      mkdirSync(dir!, { recursive: true });
      writeFileSync(path.join(dir!, `${m![1]}-${s.id}-${m![2]}.png`), await stableScreenshot(page));
    });
  });
