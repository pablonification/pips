import { checkGates } from '../support/audit';
import { isPhone, visibleText } from '../support/app';
import { expect, test } from '../support/test';

test('Curhat Yuk! lists Nadia’s rooms and opens one', async ({
  page,
}, testInfo) => {
  await page.goto('/home/curhat');
  await expect(
    page.getByRole('heading', { name: 'Messages' }).locator('visible=true'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teal Koala' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Amber Heron' }),
  ).toBeVisible();
  await checkGates(page, testInfo, 'curhat');
  await page.getByRole('heading', { name: 'Teal Koala' }).click();
  await expect(
    visibleText(
      page,
      'Oke, coba kita susun bareng ya. Mau aku bantu bikin jadwal mingguan sampai UTS?',
    ),
  ).toBeVisible();
  await expect(
    visibleText(
      page,
      'Kak, aku lagi kewalahan bagi waktu antara tubes sama kepanitiaan. Normal nggak sih?',
    ),
  ).toBeVisible();
  await checkGates(page, testInfo, 'curhat-room');
});

test('sending a message and receiving Welfare’s reply over the socket', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/home/curhat');
  await page.getByRole('heading', { name: 'Teal Koala' }).click();
  // Each room opens its own socket.io connection with the room id.
  await expect
    .poll(() =>
      [...api.socket.sessions.values()]
        .filter((s) => s.connected)
        .map((s) => s.auth.chatroomId)
        .sort(),
    )
    .toEqual(['r1', 'r2']);

  const box = page.getByRole('textbox').locator('visible=true').last();
  await box.fill('Boleh kak, makasih!');
  await box.press('Enter');
  await expect(visibleText(page, 'Boleh kak, makasih!')).toBeVisible();
  await expect
    .poll(() => api.socket.emitted('message').map((e) => e.data))
    .toEqual([
      {
        message: 'Boleh kak, makasih!',
        chatroomId: 'r1',
        userId: 'user-13525045',
        replyId: null,
      },
    ]);

  const delivered = api.socket.emit(
    'reply',
    {
      id: 'm9',
      chatroomId: 'r1',
      replyId: null,
      content: 'Siap, aku kirim draf jadwalnya malam ini ya.',
      createdAt: '2026-10-08T06:40:00.000Z',
      isSender: false,
    },
    (s) => s.auth.chatroomId === 'r1',
  );
  expect(delivered).toBe(1);
  await expect(
    visibleText(page, 'Siap, aku kirim draf jadwalnya malam ini ya.'),
  ).toBeVisible();
  if (isPhone(testInfo)) await checkGates(page, testInfo, 'curhat-room-reply');
});

test.describe('Raka, without rooms', () => {
  test.use({ persona: 'pengurus' });

  test('Raka has no rooms yet', async ({ page }, testInfo) => {
    await page.goto('/home/curhat');
    await expect(
      page
        .getByRole('button', { name: 'create chatroom' })
        .locator('visible=true'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
    await checkGates(page, testInfo, 'curhat-empty');
  });
});
