/**
 * P3-C's Welfare inbox has no locked design (OPEN-QUESTIONS D9): every screen is captured in every layout and theme
 * for the owner, next to the nearest locked screens (`*-anggota-curhat`, `*-anggota-room`, `*-pengurus-kelola`).
 * Raka with `curhatadmin` is the Welfare member. Runs only with E2E_NO_TARGET_DIR set (the fidelity report skips
 * it); use the absolute path, since a relative one ends up under `wt/ops/` from a worktree:
 *
 *   E2E_PORT=4480 E2E_NO_TARGET_DIR=/Users/macbook/Documents/coding/hmif-app/ops/redesign/proposals/P3-C \
 *     pnpm exec playwright test -c e2e e2e/fidelity/curhat-inbox-no-target.spec.ts \
 *     --project=fidelity-phone-light --project=fidelity-phone-dark --project=fidelity-tablet-light \
 *     --project=fidelity-tablet-dark --project=fidelity-desk-light --project=fidelity-desk-dark
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { NOW } from '../fixtures/api';
import { stableScreenshot } from '../support/capture';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const dir = process.env.E2E_NO_TARGET_DIR;
test.skip(
  !dir,
  'Set E2E_NO_TARGET_DIR to capture the screens with no locked target.',
);
test.use({
  platform: 'Linux x86_64',
  persona: 'pengurus',
  roles: ['curhatadmin'],
});

const main = (page: Page) => page.getByRole('main');
const log = (page: Page) =>
  page.getByRole('log', { name: 'Percakapan Teal Koala' });

async function shot(page: Page, name: string, ready: Locator) {
  await expect(ready).toBeVisible({ timeout: 15_000 });
  const [, layout, theme] = /^fidelity-(\w+)-(\w+)$/.exec(
    test.info().project.name,
  )!;
  mkdirSync(dir!, { recursive: true });
  writeFileSync(
    path.join(dir!, `${layout}-p3c-${name}-${theme}.png`),
    await stableScreenshot(page),
  );
}

test('the inbox, with a pinned room', async ({ page, db }) => {
  db.chatrooms.r2.isPinned = true;
  await page.goto('/kelola/curhat');
  await shot(
    page,
    'daftar',
    main(page).getByRole('heading', { name: 'Ruang lain' }),
  );
});

test('a search with no match', async ({ page }) => {
  await page.goto('/kelola/curhat?q=zzz');
  await shot(
    page,
    'tidak-cocok',
    main(page).getByText('Tidak ada ruang yang cocok'),
  );
});

test('no rooms at all', async ({ page, db }) => {
  db.chatrooms = {};
  await page.goto('/kelola/curhat');
  await shot(page, 'kosong', main(page).getByText('Belum ada ruang'));
});

test('a room with the member’s, a teammate’s and your own messages', async ({
  page,
  api,
  db,
}) => {
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
  db.chatrooms.r1.messages = [
    {
      id: 'm-mate',
      chatroomId: 'r1',
      replyId: null,
      content: 'Aku bantu cek jadwalnya juga ya.',
      createdAt: NOW,
      isSender: false,
      fromOwner: false,
      clientMessageId: null,
    },
    {
      id: 'm-member',
      chatroomId: 'r1',
      replyId: 'm4',
      content: 'Mau kak, makasih!',
      createdAt: new Date(Date.parse(NOW) - 60_000).toISOString(),
      isSender: false,
      fromOwner: true,
      clientMessageId: null,
    },
    ...db.chatrooms.r1.messages!,
  ];
  await page.goto('/kelola/curhat/r1');
  await expect(log(page)).toBeVisible();
  await shot(
    page,
    'ruang',
    log(page).locator('.g-bubble').filter({ hasText: 'Welfare · 13.35' }),
  );
});

test('the pin menu', async ({ page }) => {
  await page.goto('/kelola/curhat');
  await main(page)
    .getByRole('button', { name: 'Opsi untuk Amber Heron' })
    .click();
  await shot(
    page,
    'menu-sematkan',
    page.getByRole('menuitem', { name: 'Sematkan ruang' }),
  );
});

test('Layanan for a Welfare member (open question 6)', async ({ page }) => {
  await page.goto('/layanan');
  await shot(page, 'layanan', main(page).locator('a[href="/kelola/curhat"]'));
});
