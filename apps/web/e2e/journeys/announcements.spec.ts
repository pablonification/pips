import { checkGates } from '../support/audit';
import { timelineTitle, visibleText } from '../support/app';
import { reply } from '../support/mock';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

test('the feed lists the posts Nadia may see, newest first', async ({
  page,
}, testInfo) => {
  await page.goto('/timeline');
  const titles = page
    .getByRole('heading', { level: 4 })
    .locator('visible=true');
  await expect(titles.first()).toHaveText(
    'Jadwal UTS Ganjil 2026/2027 sudah keluar',
  );
  await expect(
    visibleText(page, 'PIXEL, isi Form Analisis Kondisi ya!'),
  ).toBeVisible();
  // A post for the akademik group isn't shown to Nadia.
  await expect(page.getByText('Rapat koordinasi divisi Akademik')).toHaveCount(
    0,
  );
  await checkGates(page, testInfo, 'timeline');
});

test('opening a post marks it read and shows its comments', async ({
  page,
  api,
  db,
}, testInfo) => {
  api.on('POST /api/info/:infoId/read', writes.markRead);
  await page.goto('/timeline');
  await page
    .getByRole('link', { name: 'show more' })
    .locator('visible=true')
    .first()
    .click();
  await expect(page).toHaveURL(/\/timeline\/p1$/);
  await expect(
    page.getByRole('heading', {
      name: 'Jadwal UTS Ganjil 2026/2027 sudah keluar',
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    visibleText(page, 'Kak, IF2123 K01 sama K02 ruangnya beda ya?'),
  ).toBeVisible();
  await expect
    .poll(() => api.calls('POST /api/info/p1/read').length)
    .toBeGreaterThan(0);
  expect(api.calls('POST /api/info/p1/read')[0].body).toEqual({
    unread: false,
  });
  expect(db.infos.find((i) => i.id === 'p1')?.isRead).toBe(true);
  await checkGates(page, testInfo, 'post');
});

test('reacting to a post', async ({ page, api }) => {
  api
    .on('POST /api/info/:infoId/read', writes.markRead)
    .on('PUT /api/reaction', writes.react);
  await page.goto('/timeline/p2');
  await expect(
    page.getByRole('heading', {
      name: 'Cari tim Gemastik XIX? Isi form ini',
      level: 1,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'like' }).first().click();
  await page.getByRole('button', { name: 'party' }).click();
  await expect
    .poll(() => api.calls('PUT /api/reaction').map((c) => c.body))
    .toEqual([{ reaction: 'party', infoId: 'p2' }]);
  // party went from 4 to 5 and the like button shows Nadia's reaction.
  await expect(
    page.getByText('5', { exact: true }).locator('visible=true').first(),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'like' }).first()).toHaveAttribute(
    'src',
    /like-active/,
  );
});

test('commenting on a post', async ({ page, api }) => {
  api
    .on('POST /api/info/:infoId/read', writes.markRead)
    .on('POST /api/comment', writes.comment);
  await page.goto('/timeline/p7');
  await page
    .getByPlaceholder('Share your thoughts with a reply')
    .locator('visible=true')
    .fill('Sudah ketemu, makasih!');
  await page
    .getByRole('button', { name: 'Reply' })
    .locator('visible=true')
    .click();
  await expect(visibleText(page, 'Sudah ketemu, makasih!')).toBeVisible();
  expect(api.calls('POST /api/comment')[0].body).toEqual({
    content: 'Sudah ketemu, makasih!',
    repliedInfoId: 'p7',
  });
});

test('searching the feed', async ({ page, api }) => {
  await page.goto('/timeline');
  await page
    .getByPlaceholder('Search...')
    .locator('visible=true')
    .fill('beasiswa');
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      api
        .calls('GET /api/info')
        .some((c) => c.query.includes('search=beasiswa')),
    )
    .toBe(true);
  await expect(
    visibleText(page, 'Info beasiswa bulan Oktober sudah diperbarui'),
  ).toBeVisible();
  await expect(
    page.getByText('Ketinggalan jaket abu-abu di GKU Timur'),
  ).toHaveCount(0);
});

test('an empty feed', async ({ page, api }, testInfo) => {
  api.on('GET /api/info', { infos: [] });
  await page.goto('/timeline');
  await expect(timelineTitle(page)).toBeVisible();
  await expect.poll(() => api.calls('GET /api/info').length).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { level: 4 })).toHaveCount(0);
  await checkGates(page, testInfo, 'timeline-empty');
});

test('the feed failing to load does not sign Nadia out', async ({
  page,
  api,
}) => {
  api.on('GET /api/info', reply.status(503));
  await page.goto('/timeline');
  await expect(timelineTitle(page)).toBeVisible();
  // The app retries three times, then gives up without signing out.
  await expect
    .poll(() => api.calls('GET /api/info').length, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(4);
  await expect(page).toHaveURL(/\/timeline$/);
  await expect(page.getByRole('heading', { level: 4 })).toHaveCount(0);
});
