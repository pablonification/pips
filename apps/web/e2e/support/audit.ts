/**
 * Quality gates measured on a page: axe, horizontal overflow, text size, the document language.
 *
 * Journeys run them `strict` by default (since C1): a page fails on SPEC's thresholds, no serious or critical
 * axe violation, no document overflow, no text under 12 px, `lang="id"`. `record` (E2E_GATES=record) only attaches
 * the results and fails nothing; the capture scripts (`e2e:before`, `e2e:compare-before`) use it, because the
 * before set records the app as it was before the redesign.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

export const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];
export type GatesMode = 'record' | 'strict';
export const gatesMode = (): GatesMode =>
  process.env.E2E_GATES === 'record' ? 'record' : 'strict';

export interface AxeSummary {
  total: number;
  byImpact: Record<'critical' | 'serious' | 'moderate' | 'minor', number>;
  violations: {
    id: string;
    impact: string;
    nodes: number;
    help: string;
    targets: string[];
  }[];
}
export interface PageMetrics {
  /** Document scroll width beyond the viewport, in CSS px. 0 is good. */
  overflowX: number;
  /** Visible text elements rendered under 12 px, with the smallest size found. */
  smallText: { count: number; minPx: number | null; samples: string[] };
  lang: string;
}
export interface Audit {
  axe: AxeSummary;
  metrics: PageMetrics;
}

export async function runAxe(page: Page): Promise<AxeSummary> {
  // Legacy mode runs axe in the page itself, without the extra page the default mode opens: much faster here.
  const result = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
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
  return { total: violations.length, byImpact, violations };
}

export async function measure(page: Page): Promise<PageMetrics> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const small: { size: number; text: string }[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent?.trim()) continue;
      seen.add(el);
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        rect.width === 0 ||
        rect.height === 0
      )
        continue;
      const size = parseFloat(style.fontSize);
      if (size < 12)
        small.push({ size, text: n.textContent.trim().slice(0, 40) });
    }
    return {
      overflowX: Math.max(0, doc.scrollWidth - doc.clientWidth),
      smallText: {
        count: small.length,
        minPx: small.length ? Math.min(...small.map((s) => s.size)) : null,
        samples: small.slice(0, 5).map((s) => `${s.size}px "${s.text}"`),
      },
      lang: doc.lang,
    };
  });
}

export async function audit(page: Page): Promise<Audit> {
  return { axe: await runAxe(page), metrics: await measure(page) };
}

/** Problems against SPEC's gates; empty when the page passes. */
export function gateFailures(a: Audit): string[] {
  const out: string[] = [];
  const serious = a.axe.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  if (serious.length)
    out.push(
      `axe: ${serious.map((v) => `${v.id} (${v.impact}, ${v.nodes})`).join(', ')}`,
    );
  if (a.metrics.overflowX > 0)
    out.push(`horizontal overflow: ${a.metrics.overflowX}px`);
  if (a.metrics.smallText.count)
    out.push(`text under 12px: ${a.metrics.smallText.samples.join('; ')}`);
  if (a.metrics.lang !== 'id') out.push(`lang="${a.metrics.lang}", want "id"`);
  return out;
}

/** Audit the page, attach the results to the test, and fail only in strict mode. */
export async function checkGates(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<Audit> {
  const a = await audit(page);
  const failures = gateFailures(a);
  await testInfo.attach(`gates-${name}.json`, {
    body: JSON.stringify({ mode: gatesMode(), failures, ...a }, null, 2),
    contentType: 'application/json',
  });
  if (gatesMode() === 'strict' && failures.length)
    throw new Error(
      `Quality gates failed on ${name}:\n- ${failures.join('\n- ')}`,
    );
  return a;
}
