/**
 * Captures the real app in the states of the locked prototype screens that screens.ts maps.
 * Run through `pnpm fidelity`, which sets E2E_FIDELITY_DIR and builds the side-by-side report.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stableElementScreenshot, stableScreenshot } from '../support/capture';
import { expect, test } from '../support/test';
import { EXTRAS } from './extras';
import { EXTRA_SCREENS, PENGURUS_ROUTES, ROUTES } from './names.mjs';
import { SCREENS } from './screens';

const dir = process.env.E2E_FIDELITY_DIR;

// The locked screens were rendered on Linux, so the prototype named the search shortcut "Ctrl K" (its `MOD`, ui.js).
// The app names it by platform the same way; capture it as Linux too, so the comparison is like for like.
test.use({ platform: 'Linux x86_64' });

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

// The non-route locked screens (names.mjs EXTRA_SCREENS) that extras.ts maps, each in its own project and viewport.
for (const meta of EXTRA_SCREENS) {
  const screen = EXTRAS[meta.name];
  if (!screen) continue; // not built yet: the report lists it
  test.describe(meta.name, () => {
    test.use({
      persona: screen.persona === undefined ? 'anggota' : screen.persona,
      // A 'page' capture: the window below the prototype's own bar (the report crops the bar off the locked one).
      viewport: {
        width: meta.viewport.width,
        height: meta.viewport.height - (meta.protoBar ?? 0),
      },
    });
    test(meta.name, async ({ page, api, context }, testInfo) => {
      if (!dir)
        throw new Error(
          'Run fidelity captures through `pnpm fidelity`; it sets E2E_FIDELITY_DIR.',
        );
      if (testInfo.project.name !== `fidelity-${meta.layout}-${meta.theme}`)
        return;
      screen.mock?.(api);
      await page.goto(screen.path);
      await screen.act?.(page, { api, context });
      await expect(screen.ready(page)).toBeVisible({ timeout: 15_000 });
      if (meta.capture === 'element' && !screen.target)
        throw new Error(
          `${meta.name} is an element capture: give extras.ts a target.`,
        );
      const png = screen.target
        ? await stableElementScreenshot(page, screen.target(page))
        : await stableScreenshot(page);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, `${meta.name}.png`), png);
      writeFileSync(
        path.join(dir, `${meta.name}.json`),
        JSON.stringify(
          { name: meta.name, url: page.url(), path: screen.path },
          null,
          2,
        ),
      );
    });
  });
}
