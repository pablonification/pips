/** Taking a capture: a viewport screenshot once the page is still, plus its quality-gate measurements. */
import type { Locator, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { audit, type Audit } from './audit';
import { settle } from './app';

/** Screenshots until two in a row are identical (at most `tries`), so nothing captured is mid-change. */
export async function stableScreenshot(page: Page, tries = 6): Promise<Buffer> {
  await settle(page);
  let last = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  for (let i = 1; i < tries; i++) {
    await page.waitForTimeout(150);
    const next = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
    });
    if (next.equals(last)) return next;
    last = next;
  }
  return last;
}

/** The same for one element (the fidelity tool's element captures, such as the design-system gallery's cards). */
export async function stableElementScreenshot(
  page: Page,
  target: Locator,
  tries = 6,
): Promise<Buffer> {
  await settle(page);
  const shot = () =>
    target.screenshot({ animations: 'disabled', caret: 'hide' });
  let last = await shot();
  for (let i = 1; i < tries; i++) {
    await page.waitForTimeout(150);
    const next = await shot();
    if (next.equals(last)) return next;
    last = next;
  }
  return last;
}

export interface CaptureRecord {
  id: string;
  title: string;
  variant: string;
  layout: string;
  theme: string;
  persona: string;
  path: string;
  url: string;
  image: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  audit: Audit;
}

/** Writes `<dir>/<variant>/<id>.png` and `<dir>/records/<variant>__<id>.json`. */
export async function writeCapture(
  dir: string,
  page: Page,
  record: Omit<CaptureRecord, 'image' | 'url' | 'audit'>,
): Promise<CaptureRecord> {
  const png = await stableScreenshot(page);
  const image = path.join(record.variant, `${record.id}.png`);
  mkdirSync(path.join(dir, record.variant), { recursive: true });
  mkdirSync(path.join(dir, 'records'), { recursive: true });
  writeFileSync(path.join(dir, image), png);
  const full: CaptureRecord = {
    ...record,
    image,
    url: page.url(),
    audit: await audit(page),
  };
  writeFileSync(
    path.join(dir, 'records', `${record.variant}__${record.id}.json`),
    JSON.stringify(full, null, 2),
  );
  return full;
}
