/**
 * Pengumuman's scrolling on a long, real-looking feed (owner, 2026-11-06: desktop Pengumuman "broken as hell"). On
 * desktop the list and the post scroll on their own, nothing else scrolls and neither column scrolls sideways; on
 * phones and tablets nothing scrolls sideways either. The sample data is too short to show it, so these use
 * `longPosts`: long titles, unbroken words and URLs, every post unread, more than one page.
 */
import type { Locator, Page } from '@playwright/test';
import {
  expectNoSidewaysScroll,
  longPosts,
  postInList,
  strictGates,
} from '../support/pengumuman';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const scrollOf = (l: Locator) =>
  l.evaluate((el) => ({
    top: el.scrollTop,
    left: el.scrollLeft,
    height: el.scrollHeight,
    client: el.clientHeight,
  }));

/** Wheel over the middle of `area`, `times` times. */
async function wheelOver(page: Page, area: Locator, times: number) {
  const box = (await area.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(50);
  }
}

test.describe('a long feed', () => {
  test.beforeEach(({ db, api }) => {
    db.infos = longPosts(db.infos[0], 30);
    api.on('POST /api/info/:infoId/read', writes.markRead);
  });

  test('desktop: the list and the post scroll on their own; nothing else scrolls, nothing sideways @desktop-only', async ({
    page,
  }, testInfo) => {
    const outer = page.locator('.g-desk-scroll');
    const list = page.locator('.g-split > .l');
    const pane = page.locator('.g-split > .r');
    await page.goto('/pengumuman');
    await expect(postInList(page, testInfo, 'long0')).toBeVisible();
    await expectNoSidewaysScroll(page);
    // The page area holds the two columns exactly: nothing is left for it to scroll (regression: the unread rows'
    // screen-reader text, positioned against the page area, stretched it far below the list).
    let o = await scrollOf(outer);
    expect(o.height).toBeLessThanOrEqual(o.client);

    // Down the list (its next page loads), then a row far down: the list doesn't shift sideways (regression: the
    // column widened to its longest word, and focusing the row scrolled it 14 px left, cutting every row off).
    await wheelOver(page, list, 6);
    await expect(postInList(page, testInfo, 'long15')).toBeAttached();
    const row = postInList(page, testInfo, 'long8');
    await row.click();
    await expect(page).toHaveURL(/\/pengumuman\/long8/);
    await expect(row).toBeFocused();
    await expectNoSidewaysScroll(page);
    const listBefore = (await scrollOf(list)).top;

    // The post scrolls to its end; the page area and the list stay put (regression: the page area scrolled on
    // after the post, the list's head left the window and the screen went blank).
    await wheelOver(page, pane, 12);
    const r = await scrollOf(pane);
    expect(r.top).toBeGreaterThan(0);
    expect(r.top + r.client).toBeGreaterThanOrEqual(r.height - 1);
    o = await scrollOf(outer);
    expect(o.top).toBe(0);
    expect(o.height).toBeLessThanOrEqual(o.client);
    expect((await scrollOf(list)).top).toBe(listBefore);
    await expect(row).toBeInViewport();
    await expectNoSidewaysScroll(page);

    // And back up the list: the post stays where it was.
    await wheelOver(page, list, 3);
    expect((await scrollOf(pane)).top).toBe(r.top);
    expect((await scrollOf(outer)).top).toBe(0);
    await strictGates(page, testInfo, 'long-feed-desk');
  });

  test('phones and tablets: the feed and a long post never scroll sideways @phone-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/pengumuman');
    await expect(postInList(page, testInfo, 'long0')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await postInList(page, testInfo, 'long1').focus();
    await expectNoSidewaysScroll(page);
    await postInList(page, testInfo, 'long0').click();
    await expect(page).toHaveURL(/\/pengumuman\/long0/);
    await expect(page.locator('article.g-detail')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await strictGates(page, testInfo, 'long-post');
    // A title that is one long word.
    await page.goto('/pengumuman/long1');
    await expect(page.locator('article.g-detail')).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});
