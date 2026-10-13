/**
 * Helpers for P1-A's journeys (Beranda, Kalender, search): the strict gates on every screen they reach (SPEC
 * "Testing Decisions"), the widths and zoom the layouts must fit, touch targets and visible focus.
 */
import { expect, type Page, type TestInfo } from '@playwright/test';
import { audit, gateFailures } from './audit';

/** Axe (no serious or critical finding), no sideways scrolling, no text under 12 px, `lang="id"`: failing the test. */
export async function strictGates(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const a = await audit(page);
  const scroller = await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>(
      '[data-scroll-restoration-id="isi"]',
    );
    return s ? s.scrollWidth - s.clientWidth : 0;
  });
  await testInfo.attach(`gates-${name}.json`, {
    body: JSON.stringify({ mode: 'strict', scroller, ...a }, null, 2),
    contentType: 'application/json',
  });
  expect(gateFailures(a), name).toEqual([]);
  expect(
    scroller,
    `${name}: the page area scrolls sideways`,
  ).toBeLessThanOrEqual(0);
}

/**
 * No sideways scrolling, no control cut off at the page's edges, no text under 12 px, and on phones inputs at
 * 16 px: what a width or zoom level must keep.
 */
export async function expectFits(page: Page, where: string) {
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const scroller = document.querySelector<HTMLElement>(
      '[data-scroll-restoration-id="isi"]',
    );
    const main = document.querySelector<HTMLElement>('#isi');
    const box = main?.getBoundingClientRect();
    const clipped: string[] = [];
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('#isi *')) {
      if (!el.checkVisibility()) continue;
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent?.trim(),
      );
      if (own && parseFloat(getComputedStyle(el).fontSize) < 12)
        small.push(`${el.className}: ${getComputedStyle(el).fontSize}`);
      if (box && el.matches('button, a, input')) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.left < box.left - 1 || r.right > box.right + 1))
          clipped.push(
            el.textContent?.trim() ||
              el.getAttribute('aria-label') ||
              el.tagName,
          );
      }
    }
    return {
      doc: Math.max(0, doc.scrollWidth - doc.clientWidth),
      scroller: scroller
        ? Math.max(0, scroller.scrollWidth - scroller.clientWidth)
        : 0,
      clipped,
      small,
    };
  });
  expect(m, where).toEqual({ doc: 0, scroller: 0, clipped: [], small: [] });
}

/** Each element's hit area (its box, or its ::before when that reaches further), in CSS px. */
export async function hitSizes(page: Page, selector: string) {
  return page.evaluate((selector) => {
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => el.checkVisibility())
      .map((el) => {
        const r = el.getBoundingClientRect();
        const before = getComputedStyle(el, '::before');
        const grow =
          before.content !== 'none' && before.position === 'absolute'
            ? {
                w: -2 * Math.min(0, parseFloat(before.left) || 0),
                h: -2 * Math.min(0, parseFloat(before.top) || 0),
              }
            : { w: 0, h: 0 };
        return {
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim(),
          w: Math.round(r.width + grow.w),
          h: Math.round(r.height + grow.h),
        };
      });
  }, selector);
}

/** The element with focus draws a visible ring (outline or box-shadow). */
export async function focusIsVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    const ring =
      (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== 'none';
    // A tile draws its ring on its key (garis.css `.tile-btn:focus-visible .key`).
    const inner = el.querySelector<HTMLElement>('.key');
    const innerRing = inner
      ? getComputedStyle(inner).outlineStyle !== 'none'
      : false;
    return ring || innerRing;
  });
}

/** Text in the page area only (not the shell's bars), whitespace collapsed. */
export const mainText = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector('#isi')?.textContent?.replace(/\s+/g, ' ') ?? '',
  );

export const isDark = (t: TestInfo) => t.project.name.endsWith('dark');
