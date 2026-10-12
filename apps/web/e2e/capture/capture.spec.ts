/**
 * Captures every state in states.ts for the before set (`e2e:before`) or a comparison (`e2e:compare-before`).
 * Run through those scripts: they set E2E_CAPTURE_DIR and build the manifest, gallery and report afterwards.
 */
import { expect, test } from '../support/test';
import { writeCapture } from '../support/capture';
import { STATES } from './states';

const dir = process.env.E2E_CAPTURE_DIR;

for (const state of STATES) {
  test.describe(state.id, () => {
    test.use({
      persona: state.persona ?? 'anggota',
      signedIn: state.signedIn ?? true,
      installed: state.installed ?? true,
    });

    const tag =
      state.only === 'phone'
        ? ' @phone-only'
        : state.only === 'desktop'
          ? ' @desktop-only'
          : '';
    test(`${state.id}${tag}`, async ({
      page,
      api,
      context,
      persona,
    }, testInfo) => {
      if (!dir)
        throw new Error(
          'Run captures through `pnpm e2e:before` or `pnpm e2e:compare-before`; they set E2E_CAPTURE_DIR.',
        );
      state.mock?.(api);
      await page.goto(state.path);
      await state.act?.(page, { api, context });
      await expect(state.ready(page)).toBeVisible({ timeout: 15_000 });
      const [, layout, theme] = /^capture-(\w+)-(\w+)$/.exec(
        testInfo.project.name,
      )!;
      const use = testInfo.project.use;
      await writeCapture(dir!, page, {
        id: state.id,
        title: state.title,
        variant: `${layout}-${theme}`,
        layout,
        theme,
        persona: persona ?? 'signed out',
        path: state.path,
        width: use.viewport!.width,
        height: use.viewport!.height,
        deviceScaleFactor: use.deviceScaleFactor ?? 1,
      });
    });
  });
}
