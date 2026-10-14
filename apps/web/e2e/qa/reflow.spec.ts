/**
 * F2 (brief, "The matrix"; accessibility.md A12): 400 % zoom, a 1280 px wide window shown at 320 × 256 CSS px with
 * device scale 4, on the qa-reflow project. Every page as each person it differs for: no sideways scrolling, no
 * control cut off by the window, and the page's title still reachable. The other widths and 200 % zoom are the
 * review's sweep and the journeys' `expectFitsEverywhere`.
 */
import { ROUTES } from '../review/routes';
import { expect, test } from '../support/test';
import { openSettled } from './probe';

for (const [path, route] of Object.entries(ROUTES))
  for (const who of route.as)
    test.describe(`${path} as ${who.key}`, () => {
      test.use(who.use);
      test(`400 % zoom: ${route.url} as ${who.key}`, async ({
        page,
        api,
      }, testInfo) => {
        test.skip(testInfo.project.name !== 'qa-reflow', 'qa-reflow');
        await openSettled(page, api, route.url);
        const problems = await page.evaluate(() => {
          const doc = document.documentElement;
          const out: string[] = [];
          if (doc.scrollWidth > doc.clientWidth + 1)
            out.push(`overflow ${doc.scrollWidth - doc.clientWidth}px`);
          for (const el of document.querySelectorAll<HTMLElement>(
            'a, button, input, select, textarea, [role="switch"], [role="radio"], [role="tab"]',
          )) {
            if (!el.checkVisibility()) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.left < -1 || r.right > doc.clientWidth + 1)
              out.push(
                `clipped: ${(el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 40)}`,
              );
          }
          return out;
        });
        expect(problems).toEqual([]);
        await expect(
          page.locator('h1:visible').or(page.getByRole('dialog')),
        ).not.toHaveCount(0);
      });
    });
