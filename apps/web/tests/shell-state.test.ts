import { strict as assert } from 'node:assert';
import { test } from 'node:test';

/*
 * What the shell remembers in the tab (src/components/shell/shell-state.ts): titles screens gave themselves and the
 * pages behind back. Review M5: they stayed after sign-out, for whoever signed in next on the device, and back could
 * follow an entry from before a sign-in.
 */

const map = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  },
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// The page, for its pagehide event.
const page = new EventTarget();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: page,
});

const shell = await import('../src/components/shell/shell-state');

test('forgetShell: no title, no back history, nothing in the tab, and nothing written back later', async () => {
  shell.setTitleFor('/layanan/curhat/r1', 'Ruang rahasia');
  shell.recordEntry(3, '/layanan/curhat/r1', 'Ruang rahasia');
  shell.setLastRoot('kalender');
  await wait(300);
  assert.match(map.get('pips:shell') ?? '', /Ruang rahasia/);

  // A write is waiting when the member signs out.
  shell.setTitleFor('/layanan/form/pixel', 'Form Analisis Kondisi PIXEL');
  shell.forgetShell();
  assert.equal(shell.titleFor('/layanan/curhat/r1'), undefined);
  assert.equal(shell.titleFor('/layanan/form/pixel'), undefined);
  assert.equal(shell.entryAt(3), undefined);
  assert.equal(shell.lastRoot(), 'beranda');
  assert.equal(map.has('pips:shell'), false);
  await wait(300);
  assert.equal(map.has('pips:shell'), false);
});

test('after forgetShell, back has no page from before to go to', () => {
  shell.recordEntry(0, '/kalender', 'Kalender');
  shell.recordEntry(1, '/layanan', 'Layanan');
  shell.forgetShell();
  // Signed in again on a deep link at the same history position: back goes up, not to the old entry.
  assert.equal(shell.entryAt(1), undefined);
  assert.equal(shell.entryAt(0), undefined);
});

test('components subscribed to titles see them cleared', () => {
  shell.setTitleFor('/x', 'Judul');
  const before = shell.titlesSnapshot();
  shell.forgetShell();
  assert.notEqual(shell.titlesSnapshot(), before);
  assert.deepEqual(shell.titlesSnapshot(), {});
});

test('a change is written before the page goes away, not lost to a reload within 200 ms (P1-B, found by the shell journey)', async () => {
  shell.forgetShell();
  shell.setLastRoot('layanan');
  assert.equal(map.has('pips:shell'), false, 'still waiting');
  page.dispatchEvent(new Event('pagehide'));
  assert.match(map.get('pips:shell') ?? '', /"lastRoot":"layanan"/);
  // Nothing written twice later.
  map.delete('pips:shell');
  await wait(300);
  assert.equal(map.has('pips:shell'), false);
});
