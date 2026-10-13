/**
 * Strict quality gates for redesigned screens (P1-C brief, "Gates on every journey"), whatever E2E_GATES says:
 * - zero serious or critical axe violations (today's screens inside, `[data-legacy]`, left out), text ≥ 12 px,
 *   `lang="id"`, no horizontal overflow (audit.ts);
 * - inputs at 16 px or more on touch layouts (no zoom on focus);
 * - a visible focus indicator at every Tab stop in the page;
 * - the main navigation lights the item for this route;
 * - at 320, 390, 768, 1024 and 1440 px wide and at 200 % zoom: no overflow and no control clipped by the window.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { layoutOf } from './app';
import { AXE_TAGS, gateFailures, measure } from './audit';
import { expect } from './test';

type Lit =
  'Beranda' | 'Pengumuman' | 'Kalender' | 'Layanan' | 'Kelola' | 'Profil';

/** axe, text size, lang and overflow, failing on any problem. With an overlay open, checks that too. */
export async function strictAudit(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const result = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('[data-legacy]')
    .setLegacyMode(true)
    .analyze();
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const violations = result.violations.map((v) => {
    const impact = (v.impact ?? 'minor') as keyof typeof byImpact;
    byImpact[impact] += 1;
    return {
      id: v.id,
      impact,
      nodes: v.nodes.length,
      help: v.help,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    };
  });
  const a = {
    axe: { total: violations.length, byImpact, violations },
    metrics: await measure(page),
  };
  const failures = gateFailures(a);
  if (layoutOf(testInfo) !== 'desktop') {
    const small = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLInputElement>(
          'input, textarea, select',
        ),
      ]
        .filter(
          (el) =>
            el.checkVisibility() &&
            el.type !== 'radio' &&
            el.type !== 'checkbox',
        )
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map(
          (el) =>
            el.getAttribute('aria-label') ??
            el.getAttribute('placeholder') ??
            el.tagName,
        ),
    );
    if (small.length)
      failures.push(`inputs under 16px on touch: ${small.join(', ')}`);
  }
  await testInfo.attach(`strict-gates-${name}.json`, {
    body: JSON.stringify({ failures, ...a }, null, 2),
    contentType: 'application/json',
  });
  expect(failures, `quality gates on ${name}`).toEqual([]);
}

/** Tabs through the page (at most `max` stops); every focused element must show a focus indicator. */
export async function expectVisibleFocus(page: Page, max = 30) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const seen = new Set<string>();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const ring =
        (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
        (s.boxShadow && s.boxShadow !== 'none');
      // Some controls draw their ring on a wrapper (Seg's label) or a pseudo-element: accept a ring on the parent
      // that :has(:focus-visible).
      const parent = el.closest('label, .g-seg, .g-searchbox, .g-rating');
      const ps = parent ? getComputedStyle(parent) : null;
      const parentRing =
        !!ps &&
        ((ps.outlineStyle !== 'none' && parseFloat(ps.outlineWidth) > 0) ||
          (ps.boxShadow !== 'none' && ps.boxShadow !== ''));
      const id = `${el.tagName}|${el.getAttribute('aria-label') ?? ''}|${(el.textContent ?? '').trim().slice(0, 30)}|${el.getBoundingClientRect().top}`;
      return { id, ok: !!ring || parentRing, name: id };
    });
    if (!info) continue;
    if (seen.has(info.id)) break;
    seen.add(info.id);
    expect(info.ok, `focus indicator on ${info.name}`).toBe(true);
  }
  expect(seen.size, 'Tab reaches something').toBeGreaterThan(0);
}

/**
 * The navigation lights exactly the item for this route. Profil has no tab: on phones and tablets the tab you came
 * from stays lit (one item), on desktop your name at the sidebar's foot is the current page.
 */
export async function expectLit(page: Page, testInfo: TestInfo, name: Lit) {
  const lit = page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .locator('[aria-current="page"]');
  if (name === 'Profil') {
    if (layoutOf(testInfo) === 'desktop') {
      await expect(lit).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: / Profil$/ }),
      ).toHaveAttribute('aria-current', 'page');
    } else await expect(lit).toHaveCount(1);
    return;
  }
  await expect(lit).toHaveCount(1);
  await expect(lit).toHaveAccessibleName(new RegExp(`^${name}`));
}

/** No overflow and no clipped control at the brief's widths, then at 200 % zoom; restores the window after. */
export async function expectFitsEverywhere(page: Page) {
  const original = page.viewportSize()!;
  const check = async (label: string) => {
    const problems = await page.evaluate(() => {
      const doc = document.documentElement;
      const out: string[] = [];
      if (doc.scrollWidth > doc.clientWidth)
        out.push(`overflow ${doc.scrollWidth - doc.clientWidth}px`);
      for (const el of document.querySelectorAll<HTMLElement>(
        'main button, main a, main input, main [role="switch"], main [role="radio"]',
      )) {
        if (!el.checkVisibility()) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.left < -1 || r.right > doc.clientWidth + 1)
          out.push(
            `clipped: ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}`,
          );
      }
      return out;
    });
    expect(problems, `fits at ${label}`).toEqual([]);
  };
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: original.height });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await check(`${width}px`);
  }
  // 200 % zoom on a 1440 px window is a 720 px CSS viewport.
  await page.setViewportSize({
    width: 720,
    height: Math.round(original.height / 2),
  });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await check('200% zoom');
  await page.setViewportSize(original);
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

/** Every strict gate for a screen: the audit, focus at each Tab stop, the lit item, and the widths. */
export async function strictGates(
  page: Page,
  testInfo: TestInfo,
  name: string,
  lit: Lit | null,
) {
  await strictAudit(page, testInfo, name);
  if (lit) await expectLit(page, testInfo, lit);
  await expectVisibleFocus(page);
  await expectFitsEverywhere(page);
}
