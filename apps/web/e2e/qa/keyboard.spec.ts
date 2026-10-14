/**
 * F2 (brief step 4, accessibility.md A2 and A3): a Tab walk on every page, at phone (a hardware keyboard on the touch
 * layout), tablet and desktop, in light and dark. On each page:
 * - the first stop is the skip link (pages with the shell);
 * - every stop has a name, and a focus ring at least 2 px wide with 3:1 against what is behind it;
 * - no stop is covered by a fixed or sticky bar (the tab bar, the top bar, a sticky toolbar) at five points.
 * The walk stops when focus comes back to a stop it has seen, or after 40 stops.
 */
import { ROUTES } from '../review/routes';
import { expect, test } from '../support/test';
import { contrastRatio, over, parseColor, type Rgba } from './lib';
import { openSettled, QA_LAYOUT, readStop, type Stop } from './probe';

const NO_SHELL = new Set(['/login', '/mulai']);
const MAX = 40;

/** The colour behind a ring: its layers, see-through ones blended down onto the first opaque one. */
function behind(layers: string): Rgba | null {
  const parsed = layers
    .split(' | ')
    .map(parseColor)
    .filter((c): c is Rgba => c !== null);
  if (!parsed.length) return null;
  let base = parsed.find((c) => c.a >= 1) ?? { r: 255, g: 255, b: 255, a: 1 };
  const idx = parsed.indexOf(base);
  for (let i = (idx === -1 ? parsed.length : idx) - 1; i >= 0; i--)
    base = over(parsed[i], base);
  return base;
}

function ringProblem(stop: Stop): string | null {
  if (!stop.ring) return 'no focus ring';
  if (stop.ring.width < 2) return `ring ${stop.ring.width}px`;
  const ring = parseColor(stop.ring.colour);
  const bg = behind(stop.ring.behind);
  if (!ring || !bg) return null;
  const ratio = contrastRatio(ring.a < 1 ? over(ring, bg) : ring, bg);
  return ratio < 3
    ? `ring ${stop.ring.colour} on ${stop.ring.behind}: ${ratio.toFixed(2)}:1`
    : null;
}

for (const [path, route] of Object.entries(ROUTES)) {
  const who = route.as[route.as.length - 1];
  test.describe(`${path} as ${who.key}`, () => {
    test.use(who.use);
    test(`Tab walk on ${route.url} as ${who.key}`, async ({
      page,
      api,
    }, testInfo) => {
      test.skip(!QA_LAYOUT.test(testInfo.project.name), 'a qa layout');
      await openSettled(page, api, route.url);
      // Tab from the top of the page: focus the body for a moment, so the walk doesn't start after a field the page
      // focused itself (Buat pengumuman focuses its text).
      // First let the page put focus where it wants (Buat pengumuman focuses its text a moment after it opens; on a
      // busy machine that came after the reset below, so the walk began after the field): wait until focus has
      // stayed on one element for 300 ms.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let last = document.activeElement;
            let since = performance.now();
            const tick = () => {
              if (document.activeElement !== last) {
                last = document.activeElement;
                since = performance.now();
              }
              if (performance.now() - since >= 300) resolve();
              else requestAnimationFrame(tick);
            };
            tick();
          }),
      );
      // A page that opens with focus in a field of its own (Buat pengumuman's text) starts there for a keyboard
      // user, not at the skip link.
      const ownField = await page.evaluate(
        () =>
          !!document.activeElement?.matches('input, textarea, select') &&
          !document.activeElement.closest('[role="dialog"]'),
      );
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        document.body.tabIndex = -1;
        document.body.focus();
        document.body.removeAttribute('tabindex');
        window.scrollTo(0, 0);
      });
      const seen = new Set<string>();
      const problems: string[] = [];
      for (let i = 0; i < MAX; i++) {
        await page.keyboard.press('Tab');
        const stop = await readStop(page);
        if (!stop) continue;
        // A page that opens as a dialog (Buat pengumuman on tablets and desktop) keeps focus inside it.
        if (i === 0 && !NO_SHELL.has(path) && !stop.inDialog && !ownField)
          expect(
            stop.skipLink,
            `the first stop is the skip link, not ${stop.name}`,
          ).toBe(true);
        if (seen.has(stop.id)) break;
        seen.add(stop.id);
        if (!stop.name) problems.push(`${stop.id}: no name`);
        const ring = ringProblem(stop);
        if (ring) problems.push(`${stop.id}: ${ring}`);
        if (stop.coveredBy.length)
          problems.push(`${stop.id}: covered by ${stop.coveredBy.join(', ')}`);
      }
      expect(seen.size, 'Tab reaches something').toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
  });
}
