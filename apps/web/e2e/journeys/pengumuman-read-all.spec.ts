/**
 * Tandai semua dibaca: beside Belum dibaca while anything is
 * unread, on phones, tablets and desktop in light and dark. One request; the count, the navigation badge and the list
 * follow; a failure says so with Coba lagi.
 */
import { reply } from '../support/mock';
import {
  expectUnread,
  postInList,
  strictGates,
  toastText,
} from '../support/pengumuman';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const markAll = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Tandai semua dibaca' });
const unreadChip = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Belum dibaca/ });

test.describe('Tandai semua dibaca', () => {
  test('marks every post read: the count, the badge and the list follow; the control goes', async ({
    page,
    api,
    db,
  }, testInfo) => {
    api.on('POST /api/info/read-all', writes.readAll);
    await page.goto('/pengumuman');
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
    await expectUnread(page, 4);
    // Beside Belum dibaca, in the same row.
    await expect(
      page
        .getByRole('group', { name: 'Saring pengumuman' })
        .getByRole('button'),
    ).toHaveText([
      /^Belum dibaca/,
      'Tandai semua dibaca',
      /Terbaru/,
      /Kategori/,
    ]);
    await strictGates(page, testInfo, 'read-all-shown');

    await markAll(page).click();
    await expect(
      toastText(page, 'Semua pengumuman ditandai sudah dibaca.'),
    ).toBeVisible();
    expect(api.calls('POST /api/info/read-all')).toHaveLength(1);
    expect(db.infos.every((i) => i.isRead)).toBe(true);
    await expectUnread(page, 0);
    await expect(markAll(page)).toHaveCount(0);
    // Its place is gone: focus moves to Belum dibaca, not to the page's start.
    await expect(unreadChip(page)).toBeFocused();
    // No row or card says "belum dibaca" any more.
    await expect(page.getByText('(belum dibaca)')).toHaveCount(0);

    // The Belum dibaca view is now empty, as the server says.
    await unreadChip(page).click();
    await expect(
      page.getByText('Semua pengumuman sudah kamu baca.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'read-all-done');
  });

  test('from the Belum dibaca view, the list empties', async ({
    page,
    api,
  }) => {
    api.on('POST /api/info/read-all', writes.readAll);
    await page.goto('/pengumuman?unread=true');
    await expect(unreadChip(page)).toHaveAttribute('aria-pressed', 'true');
    await markAll(page).click();
    await expect(
      page.getByText('Semua pengumuman sudah kamu baca.'),
    ).toBeVisible();
    await expectUnread(page, 0);
  });

  test('a failure keeps the count and says so; Coba lagi marks them', async ({
    page,
    api,
  }, testInfo) => {
    let fail = true;
    api.on('POST /api/info/read-all', (req) =>
      fail ? reply.status(503) : writes.readAll(req),
    );
    await page.goto('/pengumuman');
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
    await markAll(page).click();
    await expect(
      toastText(page, 'Belum berhasil menandai semua dibaca.'),
    ).toBeVisible();
    await expectUnread(page, 4);
    await expect(markAll(page)).toBeVisible();
    await strictGates(page, testInfo, 'read-all-failed');
    fail = false;
    await page
      .locator('.g-toast-region')
      .getByRole('button', { name: 'Coba lagi' })
      .click();
    await expect(
      toastText(page, 'Semua pengumuman ditandai sudah dibaca.'),
    ).toBeVisible();
    await expectUnread(page, 0);
    expect(api.calls('POST /api/info/read-all')).toHaveLength(2);
  });

  test('with nothing unread there is nothing to mark', async ({
    page,
    db,
  }, testInfo) => {
    for (const i of db.infos) i.isRead = true;
    await page.goto('/pengumuman');
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
    await expectUnread(page, 0);
    await expect(markAll(page)).toHaveCount(0);
  });
});
