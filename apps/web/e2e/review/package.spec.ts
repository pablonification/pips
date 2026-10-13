/**
 * The built review package, opened from the file system (F1 brief, "Tests"): at 390 and 1440 px, every video, image
 * and link target exists inside the package, no request leaves the folder, axe finds no serious or critical
 * violation, the filters work, a video plays, a note saves and copies, and without media/ every video and image says
 * which release file to download.
 *
 * REVIEW_PACKAGE=<folder> checks a real package (part 2: ops/redesign/review). Without it, the spec checks a small
 * fake package it writes itself (scripts/lib/review/fake.mjs: placeholder clips ffmpeg makes from a still).
 * Run: `playwright test -c e2e --project=review-package`.
 */
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { writeFakePackage } from '../scripts/lib/review/fake.mjs';
import { AXE_TAGS } from '../support/audit';

const real = process.env.REVIEW_PACKAGE ? path.resolve(process.env.REVIEW_PACKAGE) : null;
const fakeDir = path.join(os.tmpdir(), `pips-review-fake-${process.pid}`);
const bareDir = `${fakeDir}-no-media`;
const dir = real ?? fakeDir;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => {
  if (real) return;
  writeFakePackage(fakeDir);
  writeFakePackage(bareDir, { media: false });
});

/** Every request the page makes, and whether it stayed inside `root`. */
function watch(page: Page, root: string) {
  const outside: string[] = [];
  const base = pathToFileURL(root).href;
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) outside.push(u);
  });
  return outside;
}

for (const width of [390, 1440])
  test(`at ${width} px: files, requests, axe, filters, a video, a note`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width, height: 900 });
    const outside = watch(page, dir);
    await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Every target is a file inside the package.
    const refs = await page.evaluate(() =>
      [
        ...[...document.querySelectorAll('img[src], video[src], script[src]')].map((e) => e.getAttribute('src')!),
        ...[...document.querySelectorAll('video[poster]')].map((e) => e.getAttribute('poster')!),
        ...[...document.querySelectorAll('a[href], link[href]')].map((e) => e.getAttribute('href')!),
        ...[...document.querySelectorAll('script[data-recordings-of]')].flatMap((s) =>
          (JSON.parse(s.textContent || '[]') as { file: string | null; poster: string | null }[]).flatMap((r) => [r.file, r.poster]),
        ),
      ].filter((x): x is string => !!x && !x.startsWith('#')),
    );
    for (const ref of refs) {
      expect(ref, 'a relative path').not.toMatch(/^[a-z]+:|^\//i);
      const file = path.join(dir, decodeURIComponent(ref.split('#')[0]));
      expect(file.startsWith(dir), `${ref} stays inside the package`).toBe(true);
      expect(existsSync(file), `${ref} exists`).toBe(true);
    }

    // Accessibility.
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).setLegacyMode(true).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    // A filter: only the close screens.
    const cards = page.locator('li.card[data-scope="fidelity"]');
    const close = await page.locator('li.card[data-scope="fidelity"][data-status="close"]').count();
    await page.locator('select[data-filter="status"][data-scope="fidelity"]').selectOption('close');
    await expect(page.locator('[data-count="fidelity"]')).toHaveText(String(close));
    await expect(cards.locator('visible=true')).toHaveCount(close);
    await page.locator('select[data-filter="status"][data-scope="fidelity"]').selectOption('');

    // A video plays, and a step jumps it to its time.
    const video = page.locator('video').first();
    await video.scrollIntoViewIfNeeded();
    await page.locator('article.flow').first().locator('summary', { hasText: 'Steps' }).click();
    await page.locator('article.flow').first().locator('[data-t]').nth(1).click();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.5);

    // A note saves, survives a reload and copies.
    const note = page.locator('fieldset.note').first();
    await note.getByLabel('Not OK').check();
    await note.getByRole('textbox').fill('Teks “Isi” terlalu kecil');
    await page.reload();
    await expect(page.locator('fieldset.note').first().getByLabel('Not OK')).toBeChecked();
    await expect(page.locator('fieldset.note').first().getByRole('textbox')).toHaveValue('Teks “Isi” terlalu kecil');
    await page.getByRole('button', { name: 'Copy my notes' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Notes copied.' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('(not ok): Teks “Isi” terlalu kecil');

    expect(outside, 'requests outside the package').toEqual([]);
  });

test('without media/: every video and image says which release file to download', async ({ page }) => {
  test.skip(!!real, 'checked on the fake package');
  const outside = watch(page, bareDir);
  await page.goto(pathToFileURL(path.join(bareDir, 'index.html')).href);
  await expect(page.locator('.missing-media')).toBeVisible();
  await expect(page.locator('[data-media]')).toHaveCount(0);
  const lines = page.locator('p.missing');
  expect(await lines.count()).toBeGreaterThan(3);
  await expect(lines.first()).toHaveText(/download review-2026-10-14\.zip from the release/);
  expect(outside).toEqual([]);
});

