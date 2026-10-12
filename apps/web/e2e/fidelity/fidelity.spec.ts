/**
 * Captures the real app in the states of the locked prototype screens that screens.ts maps.
 * Run through `pnpm fidelity`, which sets E2E_FIDELITY_DIR and builds the side-by-side report.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stableScreenshot } from '../support/capture';
import { expect, test } from '../support/test';
import { PENGURUS_ROUTES, ROUTES } from './names.mjs';
import { SCREENS } from './screens';

const dir = process.env.E2E_FIDELITY_DIR;

for (const [persona, routes] of [
  ['anggota', ROUTES],
  ['pengurus', PENGURUS_ROUTES],
] as const) {
  for (const route of routes) {
    const screen = SCREENS[`${persona}-${route}`];
    if (!screen) continue; // not built yet: the report lists it
    test.describe(`${persona}-${route}`, () => {
      test.use({ persona });
      test(`${persona}-${route}`, async ({ page, api, context }, testInfo) => {
        if (!dir)
          throw new Error(
            'Run fidelity captures through `pnpm fidelity`; it sets E2E_FIDELITY_DIR.',
          );
        const [, layout, theme] = /^fidelity-(\w+)-(\w+)$/.exec(
          testInfo.project.name,
        )!;
        if (screen.layouts && !screen.layouts.includes(layout as 'phone'))
          return;
        screen.mock?.(api);
        await page.goto(screen.path);
        await screen.act?.(page, { api, context });
        await expect(screen.ready(page)).toBeVisible({ timeout: 15_000 });
        const name = `${layout}-${persona}-${route}-${theme}`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          path.join(dir, `${name}.png`),
          await stableScreenshot(page),
        );
        writeFileSync(
          path.join(dir, `${name}.json`),
          JSON.stringify({ name, url: page.url(), path: screen.path }, null, 2),
        );
      });
    });
  }
}
