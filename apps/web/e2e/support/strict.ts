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

/**
 * Tabs through the page (at most `max` stops); every focused element must show a focus indicator.
 *
 * The indicator is found by comparing the same control focused and blurred (review m7): Garis buttons, chips,
 * fields and switches carry a shadow at rest, so "has an outline or a shadow" passed controls with no focus style
 * at all. At each stop the gate reads the outline, shadow, border and background of the control, its ::before and
 * ::after, and its three nearest ancestors (Seg, the rating and the search box draw the ring on a wrapper that
 * `:has(:focus-visible)` or is `:focus-within`), blurs the control, reads them again, and focuses it again. Nothing
 * changed means no visible focus. Transitions are switched off meanwhile, so neither reading catches one midway.
 */
export async function expectVisibleFocus(page: Page, max = 30) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
    const still = document.createElement('style');
    still.id = 'e2e-focus-still';
    still.textContent =
      '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.append(still);
  });
  const seen = new Set<string>();
  try {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        // What can show focus, as drawn: an outline or a border only when it is there (an outline's offset or a
        // border's colour changes nothing on screen while its style is none or its width 0).
        const look = (s: CSSStyleDeclaration) => {
          const outline =
            s.outlineStyle === 'none' || parseFloat(s.outlineWidth) === 0
              ? 'none'
              : `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} ${s.outlineOffset}`;
          const border = ['top', 'right', 'bottom', 'left']
            .map((side) => {
              const v = (p: string) =>
                s.getPropertyValue(`border-${side}-${p}`);
              return v('style') === 'none' || parseFloat(v('width')) === 0
                ? 'none'
                : `${v('width')} ${v('color')}`;
            })
            .join(' ');
          return [
            outline,
            border,
            s.boxShadow,
            s.backgroundColor,
            s.color,
            s.textDecorationLine,
            s.translate,
          ].join('|');
        };
        const nodes: [Element, string | null][] = [
          [el, null],
          [el, '::before'],
          [el, '::after'],
        ];
        for (
          let a = el.parentElement, n = 0;
          a && n < 3;
          a = a.parentElement, n++
        )
          nodes.push([a, null]);
        const read = () =>
          nodes.map(([node, pseudo]) => look(getComputedStyle(node, pseudo)));
        const focused = read();
        el.blur();
        const blurred = read();
        el.focus({ preventScroll: true });
        const role = el.getAttribute('role');
        const id = `${el.tagName}${role ? `[${role}]` : ''}|${el.getAttribute('aria-label') ?? ''}|${(el.textContent ?? '').trim().slice(0, 30)}|${el.getBoundingClientRect().top}`;
        return {
          id,
          ok: focused.some((v, k) => v !== blurred[k]),
          name: id,
        };
      });
      if (!info) continue;
      if (seen.has(info.id)) break;
      seen.add(info.id);
      expect(info.ok, `focus indicator on ${info.name}`).toBe(true);
    }
  } finally {
    await page.evaluate(() =>
      document.getElementById('e2e-focus-still')?.remove(),
    );
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
  const check = async () => {
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
    return problems;
  };
  // After a resize the page needs the new width and a render or two before it is measured (the shell switches its
  // layout from a media query in React). Measured once a frame later, a busy machine sometimes caught the desktop
  // layout still laid out in a 320 px window. A real overflow stays, so the check still fails after the wait.
  const settle = async (width: number) => {
    await page.waitForFunction((w) => window.innerWidth === w, width);
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  };
  const expectFits = (label: string) =>
    expect
      .poll(() => check(), { message: `fits at ${label}`, timeout: 3_000 })
      .toEqual([]);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: original.height });
    await settle(width);
    await expectFits(`${width}px`);
  }
  // 200 % zoom on a 1440 px window is a 720 px CSS viewport.
  await page.setViewportSize({
    width: 720,
    height: Math.round(original.height / 2),
  });
  await settle(720);
  await expectFits('200% zoom');
  await page.setViewportSize(original);
  await settle(original.width);
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
