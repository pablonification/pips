/**
 * P2-C's room states with no locked target (OPEN-QUESTIONS D7): captured in every layout and theme for the owner,
 * next to the locked `*-anggota-room` screens. Each is the window as a member sees it: the room opens at its newest
 * message, so that is where these are taken (review M1). Runs only with E2E_NO_TARGET_DIR set (the fidelity report
 * skips it):
 *
 *   E2E_NO_TARGET_DIR=../../../ops/redesign/proposals/P2-C pnpm exec playwright test -c e2e \
 *     e2e/fidelity/curhat-no-target.spec.ts --project=fidelity-phone-light --project=fidelity-phone-dark \
 *     --project=fidelity-tablet-light --project=fidelity-tablet-dark --project=fidelity-desk-light \
 *     --project=fidelity-desk-dark
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { stableScreenshot } from '../support/capture';
import type { ApiMock } from '../support/mock';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const dir = process.env.E2E_NO_TARGET_DIR;
test.skip(
  !dir,
  'Set E2E_NO_TARGET_DIR to capture the screens with no locked target.',
);
test.use({ platform: 'Linux x86_64' });

const MINE = 'Mau kak, makasih!';
const log = (page: Page) =>
  page.getByRole('log', { name: 'Percakapan Teal Koala' });
const composer = (page: Page) =>
  page.getByRole('textbox', { name: 'Tulis pesan untuk tim Welfare' });

async function shot(page: Page, name: string, ready: Locator) {
  await expect(ready).toBeVisible({ timeout: 15_000 });
  const [, layout, theme] = /^fidelity-(\w+)-(\w+)$/.exec(
    test.info().project.name,
  )!;
  mkdirSync(dir!, { recursive: true });
  writeFileSync(
    path.join(dir!, `${layout}-p2c-${name}-${theme}.png`),
    await stableScreenshot(page),
  );
}

async function openR1(page: Page, api: ApiMock) {
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
  await page.goto('/layanan/curhat/r1');
  await expect(log(page)).toBeVisible();
  await expect
    .poll(() => [...api.socket.sessions.values()].some((s) => s.connected))
    .toBe(true);
}

async function send(page: Page, text: string) {
  await composer(page).fill(text);
  await page.getByRole('button', { name: 'Kirim pesan' }).click();
}

test('Mengirim, with the reply chip and a two-line draft', async ({
  page,
  api,
}) => {
  api.socket.answer('message', () => undefined);
  await openR1(page, api);
  await send(page, MINE);
  await log(page).getByRole('button', { name: 'Balas' }).last().click();
  await composer(page).fill('Satu lagi, kak.\nBoleh minta contohnya juga?');
  await shot(
    page,
    'mengirim-reply-chip',
    log(page).locator('.g-bubble').filter({ hasText: 'Mengirim' }),
  );
});

test('Gagal with Kirim ulang', async ({ page, api }) => {
  api.socket.answer('message', () => ({ ok: false, error: 'server' }));
  await openR1(page, api);
  await send(page, MINE);
  await shot(
    page,
    'gagal',
    log(page).getByRole('button', { name: 'Kirim ulang' }),
  );
});

test('the lost connection, at the newest message where the room opens', async ({
  page,
  api,
}) => {
  await openR1(page, api);
  api.socket.drop();
  const banner = page.getByText('Koneksi Curhat terputus. Menyambungkan lagi…');
  await expect(banner).toBeInViewport({ ratio: 1 });
  await shot(page, 'terputus', banner);
});

test('offline, at the newest message', async ({ page, api }) => {
  await openR1(page, api);
  await api.setOffline(true);
  const banner = page.getByText(/^Offline · diperbarui/);
  await expect(banner).toBeInViewport({ ratio: 1 });
  await shot(page, 'offline', banner);
});

test('Ruang tidak ditemukan', async ({ page }) => {
  await page.goto('/layanan/curhat/r-hilang');
  await shot(
    page,
    'tidak-ditemukan',
    page.getByRole('main').getByText('Ruang ini sudah dihapus.'),
  );
});

test('the delete confirmation', async ({ page, api }) => {
  await openR1(page, api);
  const desk = test.info().project.name.includes('-desk-');
  await (
    desk
      ? page.getByRole('main').getByRole('button', { name: 'Hapus ruang' })
      : page.getByRole('button', { name: 'Hapus ruang ini' })
  ).click();
  await shot(
    page,
    'hapus',
    page.getByRole('alertdialog', { name: 'Hapus ruang ini?' }),
  );
});
