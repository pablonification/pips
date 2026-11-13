/**
 * Curhat Yuk! for members: the list, starting a room, a room, replying and sending with delivery states,
 * a dropped connection, Welfare's replies, deleting, the Enter key, the loading, error and offline states, and
 * Welfare being sent to its inbox. On the API's socket protocol, which the fake socket.io server speaks: the handshake
 * `auth: { curhat: true }`, `curhat:join`, and `message` acknowledged `{ ok: true, message }` or `{ ok: false }`.
 *
 * Welfare is sent to its inbox, checked at the end.
 */
import type { Locator, Page, Request, TestInfo } from '@playwright/test';
import type { CurhatSocketMessage } from '../../src/api/generated';
import { layoutOf } from '../support/app';
import { fakeGoogle, googleRequests } from '../support/google';
import { defaultHandlers } from '../support/handlers';
import { NOW } from '../fixtures/api';
import { reply, type ApiMock } from '../support/mock';
import { strictGates, toastText } from '../support/pengumuman';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const M4 =
  'Oke, coba kita susun bareng ya. Mau aku bantu bikin jadwal mingguan sampai UTS?';
const M3 = 'Tubes 1 IF2110 Jumat ini, terus rapat kepanitiaan tiap Rabu malam.';
const M1 =
  'Kak, aku lagi kewalahan bagi waktu antara tubes sama kepanitiaan. Normal nggak sih?';
const MINE = 'Mau kak, makasih!';

const main = (page: Page) => page.getByRole('main');
const mainNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigasi utama' });
/** The room rows (on desktop the breadcrumbs are links in the page too). */
const roomLinks = (page: Page) =>
  main(page).locator('a[href^="/layanan/curhat/"]');
const row = (page: Page, name: string) =>
  roomLinks(page).filter({ hasText: name });
/** The reply chip above the composer. */
const chip = (page: Page) => page.locator('.g-reply-chip');
const log = (page: Page, name = 'Teal Koala') =>
  page.getByRole('log', { name: `Percakapan ${name}` });
const composer = (page: Page) =>
  page.getByRole('textbox', { name: 'Tulis pesan untuk tim Welfare' });
const sendButton = (page: Page) =>
  page.getByRole('button', { name: 'Kirim pesan' });
const bubble = (page: Page, text: string) =>
  log(page).locator('.g-bubble').filter({ hasText: text });
const newRoom = (page: Page) =>
  main(page).getByRole('button', { name: 'Mulai ruang baru' });
const isDesk = (t: TestInfo) => layoutOf(t) === 'desktop';
/** Delete: the top bar's icon on phones and tablets, the page head's button on desktop. */
const deleteButton = (page: Page, t: TestInfo) =>
  isDesk(t)
    ? main(page).getByRole('button', { name: 'Hapus ruang' })
    : page.getByRole('button', { name: 'Hapus ruang ini' });

/** The read write is opt-in; most room journeys open r1, which has Welfare's unread m4. */
function canRead(api: ApiMock) {
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
}

async function openR1(page: Page) {
  await page.goto('/layanan/curhat/r1');
  await expect(log(page)).toBeVisible();
}

/**
 * Opens r1 and waits for its connection and the rooms read that follows it (a connection catches up on what was saved
 * before it joined the room), so a journey that counts reads or changes the rooms starts after both.
 */
async function openR1Connected(page: Page, api: ApiMock) {
  await openR1(page);
  await expect
    .poll(() =>
      [...api.socket.sessions.values()].some(
        (s) => s.connected && s.rooms.has('r1'),
      ),
    )
    .toBe(true);
  await expect
    .poll(() => api.calls('GET /api/curhat/chatrooms').length)
    .toBe(2);
}

/**
 * Counts the page's API requests in flight (the socket's long poll aside); `quiet()` waits until none has been for
 * half a second. Start it before the page opens. A journey that ends the session and then types needs it: on a slow
 * machine the room's opening reads (the unread counts again after the read mark, the shell's badge) can still be on
 * their way, come back "not signed in", and hand over to sign-in before the journey has typed.
 */
function apiInFlight(page: Page) {
  let open = 0;
  let last = Date.now();
  const counts = (r: Request) =>
    r.url().includes('/api/') && !r.url().includes('/socket.io/');
  const step = (by: number) => (r: Request) => {
    if (!counts(r)) return;
    open += by;
    last = Date.now();
  };
  page.on('request', step(1));
  const end = step(-1);
  page.on('requestfinished', end);
  page.on('requestfailed', end);
  return {
    quiet: () =>
      expect
        .poll(() => open === 0 && Date.now() - last >= 500, {
          intervals: [100],
        })
        .toBe(true),
  };
}

/** What the API acknowledges a message with (no userId), for tests that answer by hand. */
function saved(data: unknown, id = 'e2e-message-by-hand'): CurhatSocketMessage {
  const d = data as {
    chatroomId: string;
    message: string;
    replyId?: string;
    clientMessageId?: string;
  };
  return {
    id,
    chatroomId: d.chatroomId,
    replyId: d.replyId ?? null,
    content: d.message,
    createdAt: NOW,
    isSender: true,
    fromOwner: true,
    clientMessageId: d.clientMessageId ?? null,
  };
}

/** A message's device id: a UUID the app makes. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** What the app emits for a message: exactly these fields, with a fresh device id. */
const payload = (message: string, replyId: string | null = null) => ({
  chatroomId: 'r1',
  message,
  replyId,
  clientMessageId: expect.stringMatching(UUID),
});

/** The newest message is in view: the composer and the last bubble are both on screen. */
async function expectAtNewest(page: Page, lastText: string) {
  await expect(bubble(page, lastText)).toBeInViewport();
  await expect(composer(page)).toBeInViewport();
}

test.describe('the list', () => {
  test('rooms newest first, previews, times, the unread count, the privacy note and the room count', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Amber Heron')).toBeVisible();
    await expect(page).toHaveTitle('Curhat Yuk! · PIPS!');
    // Names from the server in lower case, shown as names; the unread count for screen readers.
    await expect(row(page, 'Teal Koala')).toHaveAccessibleName(
      `Teal Koala , 1 pesan baru Welfare: ${M4} 10.12`,
    );
    await expect(row(page, 'Amber Heron')).toHaveAccessibleName(
      'Amber Heron Welfare: Sama-sama! Kapan pun mau cerita lagi, ruang ini tetap ada. Sen 14 Sep',
    );
    const names = await roomLinks(page).evaluateAll((els) =>
      els.map((e) => e.textContent?.slice(2, 12)),
    );
    expect(names).toEqual(['Teal Koala', 'Amber Hero']);
    await expect(
      main(page).getByText('Anonim. Namamu tidak ditampilkan ke tim Welfare.'),
    ).toBeVisible();
    await expect(main(page).getByText('2 dari 3 ruang dipakai')).toBeVisible();
    await expect(newRoom(page)).toBeEnabled();
    // Not a focused flow: the tab bar, rail or sidebar stays, with Layanan lit.
    await expect(mainNav(page)).toBeVisible();
    await expect(
      mainNav(page).getByRole('link', { name: /^Layanan/ }),
    ).toHaveAttribute('aria-current', 'page');
    // One connection for the whole area, with the session cookie and no member id.
    await expect
      .poll(() =>
        [...api.socket.sessions.values()]
          .filter((s) => s.connected)
          .map((s) => s.auth),
      )
      .toEqual([{ curhat: true }]);
    await strictGates(page, testInfo, 'curhat-list');
  });

  test.describe('Raka, without rooms', () => {
    test.use({ persona: 'pengurus' });

    test('the empty state and the room count', async ({ page }, testInfo) => {
      await page.goto('/layanan/curhat');
      await expect(
        main(page).getByText('Belum ada ruang cerita'),
      ).toBeVisible();
      await expect(
        main(page).getByText(
          'Mulai ruang baru untuk ngobrol dengan tim Welfare HMIF.',
        ),
      ).toBeVisible();
      await expect(
        main(page).getByText('0 dari 3 ruang dipakai'),
      ).toBeVisible();
      await expect(newRoom(page)).toBeVisible();
      await strictGates(page, testInfo, 'curhat-empty');
    });
  });
});

test.describe('starting a room', () => {
  test('the server names it; it opens with its first-message hint, joined on the socket, the composer focused', async ({
    page,
    api,
  }, testInfo) => {
    api.on('POST /api/curhat/chatroom', writes.createRoom);
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await expect
      .poll(() => [...api.socket.sessions.values()].some((s) => s.connected))
      .toBe(true);
    await newRoom(page).click();
    await expect(page).toHaveURL(/\/layanan\/curhat\/e2e-room-3$/);
    await expect(
      toastText(page, 'Ruang “Lime Otter” dibuat. Namamu tetap tersembunyi.'),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        'Tulis pesan pertamamu. Tim Welfare membalas di sini.',
      ),
    ).toBeVisible();
    await expect(log(page, 'Lime Otter')).toBeAttached();
    await expect(composer(page)).toBeFocused();
    expect(api.calls('POST /api/curhat/chatroom')).toHaveLength(1);
    await expect
      .poll(() => api.socket.emitted('curhat:join').map((e) => e.data))
      .toEqual([{ chatroomId: 'e2e-room-3' }]);
    await expect(page).toHaveTitle('Lime Otter · PIPS!');
    await strictGates(page, testInfo, 'curhat-new-room');

    // Its first message is delivered.
    await composer(page).fill('Halo kak');
    await sendButton(page).click();
    await expect(
      log(page, 'Lime Otter')
        .locator('.g-bubble')
        .filter({ hasText: 'Halo kak' }),
    ).toContainText('Terkirim · 13.35');
  });

  test('at three rooms: no request, the caption and the "Maksimal 3 ruang" toast', async ({
    page,
    api,
    db,
  }) => {
    db.chatrooms.r3 = {
      id: 'r3',
      title: 'coral otter',
      messages: [],
      labels: [],
      isPinned: false,
      canDelete: true,
    };
    await page.goto('/layanan/curhat');
    await expect(main(page).getByText('3 dari 3 ruang dipakai')).toBeVisible();
    await expect(
      main(page).getByText('Hapus salah satu ruang untuk membuat yang baru.'),
    ).toBeVisible();
    // Rooms without messages come last.
    await expect(roomLinks(page).last()).toHaveAccessibleName(
      /^Coral Otter Belum ada pesan/,
    );
    await expect(newRoom(page)).toHaveAttribute('aria-disabled', 'true');
    // Still focusable and pressable (Playwright won't click an aria-disabled button, so press it).
    await newRoom(page).focus();
    await expect(newRoom(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      toastText(page, 'Maksimal 3 ruang. Hapus salah satu ruang dulu.'),
    ).toBeVisible();
    expect(api.writes).toEqual([]);
    await expect(page).toHaveURL(/\/layanan\/curhat$/);
  });

  test('a failure shows the error toast; the server’s 400 the full toast, and the rooms are fetched again', async ({
    page,
    api,
    db,
  }) => {
    await page.goto('/layanan/curhat');
    await expect(main(page).getByText('2 dari 3 ruang dipakai')).toBeVisible();
    api.on('POST /api/curhat/chatroom', reply.status(500));
    await newRoom(page).click();
    await expect(
      toastText(page, 'Ruang baru gagal dibuat. Coba lagi.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/layanan\/curhat$/);
    api.on(
      'POST /api/curhat/chatroom',
      reply.status(400, {
        error: 'You have reached the maximum chatrooms limit',
      }),
    );
    // A third room was started on another device; the list catches up after the 400.
    db.chatrooms.r3 = {
      id: 'r3',
      title: 'coral otter',
      messages: [],
      labels: [],
      isPinned: false,
      canDelete: true,
    };
    await newRoom(page).click();
    await expect(
      toastText(page, 'Maksimal 3 ruang. Hapus salah satu ruang dulu.'),
    ).toBeVisible();
    await expect(main(page).getByText('3 dari 3 ruang dipakai')).toBeVisible();
    await expect(row(page, 'Coral Otter')).toBeVisible();
    await expect(page).toHaveURL(/\/layanan\/curhat$/);
  });
});

test.describe('a room', () => {
  test('the thread opens at the newest message, read on opening', async ({
    page,
    api,
  }, testInfo) => {
    canRead(api);
    await page.goto('/layanan/curhat');
    await row(page, 'Teal Koala').click();
    await expect(page).toHaveURL(/\/layanan\/curhat\/r1$/);
    await expect(page).toHaveTitle('Teal Koala · PIPS!');
    // Oldest first, with day lines; who said it, for screen readers.
    await expect(log(page)).toContainText(
      `Senin, 5 OktoberKamu: ${M1}21.10` +
        `Selasa, 6 OktoberWelfare: Normal banget kok`,
    );
    await expect(bubble(page, M4)).toHaveText(
      `Membalas: ${M3}Welfare: ${M4}Welfare · 10.12`,
    );
    // Your newest delivered message says so; older ones only their time.
    // m3's own bubble (m4's quotes it too).
    await expect(bubble(page, M3).first()).toContainText('Terkirim · 12.30');
    await expect(bubble(page, M1)).not.toContainText('Terkirim');
    await expectAtNewest(page, M4);
    // A focused flow: no tab bar or rail on phones and tablets; the sidebar stays on desktop.
    if (isDesk(testInfo)) {
      await expect(mainNav(page)).toBeVisible();
      const crumbs = page.getByRole('navigation', { name: 'Jejak halaman' });
      await expect(crumbs.getByRole('link')).toHaveText([
        'Layanan',
        'Curhat Yuk!',
      ]);
      await expect(crumbs.locator('[aria-current="page"]')).toHaveText(
        'Teal Koala',
      );
    } else await expect(mainNav(page)).toHaveCount(0);
    await expect
      .poll(() => api.calls('POST /api/curhat/chatroom/:chatroomId/read'))
      .toHaveLength(1);
    expect(
      api.calls('POST /api/curhat/chatroom/:chatroomId/read')[0].path,
    ).toBe('/api/curhat/chatroom/r1/read');
    await strictGates(page, testInfo, 'curhat-room');

    // Back on the list the count is gone.
    await page.goBack();
    await expect(row(page, 'Teal Koala')).toHaveAccessibleName(
      `Teal Koala Welfare: ${M4} 10.12`,
    );
  });

  test('the composer stays at the bottom of the window while you read back', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    await page
      .locator('[data-scroll-restoration-id="isi"]')
      .evaluate((el) => (el.scrollTop = 0));
    await expect(bubble(page, M1)).toBeInViewport();
    await expect(composer(page)).toBeInViewport({ ratio: 1 });
    await expect(sendButton(page)).toBeInViewport({ ratio: 1 });
    // A reply chip and a long draft grow the bar upwards; it stays whole on screen.
    await log(page).getByRole('button', { name: 'Balas' }).first().click();
    await composer(page).fill('satu\ndua\ntiga\nempat');
    await page
      .locator('[data-scroll-restoration-id="isi"]')
      .evaluate((el) => (el.scrollTop = 0));
    await expect(chip(page)).toBeInViewport({ ratio: 1 });
    await expect(composer(page)).toBeInViewport({ ratio: 1 });
  });

  test('a room without unread messages isn’t marked read again', async ({
    page,
    api,
  }) => {
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Amber Heron')).toBeVisible();
    await row(page, 'Amber Heron').click();
    await expect(log(page, 'Amber Heron')).toBeVisible();
    expect(api.writes).toEqual([]);
  });

  test('a read mark that fails isn’t sent again for the same messages', async ({
    page,
    api,
  }) => {
    api.on('POST /api/curhat/chatroom/:chatroomId/read', reply.status(500));
    const inFlight = apiInFlight(page);
    await openR1Connected(page, api);
    await inFlight.quiet();
    expect(
      api.calls('POST /api/curhat/chatroom/:chatroomId/read'),
    ).toHaveLength(1);
  });

  test('replying and sending: the exact payload, Mengirim, then Terkirim on the acknowledgement', async ({
    page,
    api,
  }, testInfo) => {
    canRead(api);
    api.socket.answer('message', () => undefined);
    await openR1(page);
    await log(page).getByRole('button', { name: 'Balas' }).last().click();
    await expect(chip(page)).toHaveText(`Membalas: ${M4}`);
    await expect(composer(page)).toBeFocused();
    await strictGates(page, testInfo, 'curhat-reply-chip');
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(composer(page)).toBeFocused();
    await expect(composer(page)).toHaveValue('');
    await expect(chip(page)).toHaveCount(0);
    await expect(bubble(page, MINE)).toContainText('Mengirim');
    // Pending: no Balas under it.
    await expect(log(page).getByRole('button', { name: 'Balas' })).toHaveCount(
      4,
    );
    const [sent] = api.socket.emitted('message');
    expect(sent.data).toEqual(payload(MINE, 'm4'));
    expect(sent.ackId).toBeDefined();
    await expectAtNewest(page, MINE);

    // The bubble stays the same element from Mengirim to Terkirim, so it is announced as added once.
    const sentBubble = await bubble(page, MINE).elementHandle();
    api.socket.ack(sent, { ok: true, message: saved(sent.data, 'm10') });
    await expect(bubble(page, MINE)).toContainText('Terkirim · 13.35');
    expect(await sentBubble!.evaluate((el) => el.isConnected)).toBe(true);
    await expect(bubble(page, MINE)).toContainText(`Membalas: ${M4}`);
    await expect(bubble(page, M3).first()).not.toContainText('Terkirim');
    await expect(log(page).getByRole('button', { name: 'Balas' })).toHaveCount(
      5,
    );
    // The delivered message grows (Terkirim, then Balas) and the room stays at its end.
    await expect(
      log(page).getByRole('button', { name: 'Balas' }).last(),
    ).toBeInViewport({ ratio: 1 });
    await expect(composer(page)).toBeInViewport({ ratio: 1 });
  });

  test('Batal membalas clears the reply and returns focus to the composer', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    await log(page).getByRole('button', { name: 'Balas' }).first().click();
    await expect(chip(page)).toHaveText(`Membalas: ${M1}`);
    await page.getByRole('button', { name: 'Batal membalas' }).click();
    await expect(chip(page)).toHaveCount(0);
    await expect(composer(page)).toBeFocused();
    await composer(page).fill('Tanpa balasan');
    await sendButton(page).click();
    await expect(bubble(page, 'Tanpa balasan')).toContainText('Terkirim');
    expect(api.socket.emitted('message')[0].data).toEqual(
      payload('Tanpa balasan'),
    );
  });

  test('a reload keeps the message typed in this room only; sent, it is gone', async ({
    page,
    api,
  }) => {
    canRead(api);
    api.socket.answer('message', () => undefined);
    await openR1(page);
    await composer(page).fill('Aku masih bingung soal tugas.');
    await page.reload();
    await expect(log(page)).toBeVisible();
    await expect(composer(page)).toHaveValue('Aku masih bingung soal tugas.');
    await page.goto('/layanan/curhat/r2');
    await expect(composer(page)).toHaveValue('');
    await openR1(page);
    await expect(composer(page)).toHaveValue('Aku masih bingung soal tugas.');
    await sendButton(page).click();
    await expect(composer(page)).toHaveValue('');
    await page.reload();
    await expect(log(page)).toBeVisible();
    await expect(composer(page)).toHaveValue('');
  });

  test('empty text doesn’t send; focus stays in the field', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    await composer(page).fill('   ');
    await sendButton(page).click();
    await expect(composer(page)).toBeFocused();
    expect(api.socket.emitted('message')).toEqual([]);
  });
});

test.describe('delivery under a dropped connection', () => {
  test('no acknowledgement: Gagal after 10 s, announced once; Kirim ulang delivers', async ({
    page,
    api,
  }, testInfo) => {
    canRead(api);
    api.socket.answer('message', () => undefined);
    await openR1(page);
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(bubble(page, MINE)).toContainText('Mengirim');
    await page.clock.fastForward(9_000);
    await expect(bubble(page, MINE)).toContainText('Mengirim');
    await page.clock.fastForward(1_500);
    await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
    // Announced once, by the log adding the Gagal line; no second live region repeats it.
    await expect(log(page)).toHaveAttribute('aria-relevant', 'additions');
    await expect(
      page
        .locator('[aria-live]:not([role="log"])')
        .filter({ hasText: 'Gagal' }),
    ).toHaveCount(0);
    await expect(log(page).getByRole('button', { name: 'Balas' })).toHaveCount(
      4,
    );
    await strictGates(page, testInfo, 'curhat-failed');

    api.socket.answerAsApi('message');
    await log(page).getByRole('button', { name: 'Kirim ulang' }).click();
    await expect(bubble(page, MINE)).toContainText('Terkirim · 13.35');
    await expect(log(page).getByText('Gagal', { exact: true })).toHaveCount(0);
    // The same text and device id again, once delivered.
    const [first, again] = api.socket.emitted('message').map((e) => e.data);
    expect(first).toEqual(payload(MINE));
    expect(again).toEqual(first);
    expect(api.socket.emitted('message')).toHaveLength(2);
  });

  test('the reply chip never covers a failed message’s Kirim ulang', async ({
    page,
    api,
  }) => {
    canRead(api);
    api.socket.answer('message', () => ({ ok: false, error: 'server' }));
    await page.setViewportSize({ width: 390, height: 900 });
    await openR1(page);
    // A long message, as the gates found it (desktop at 390 px): its line ends right where the bar grows.
    await composer(page).fill(
      'Aku pengen cerita panjang soal minggu ini karena rasanya semua tenggat datang bersamaan dan aku belum tahu harus mulai dari mana, apalagi ada rapat kepanitiaan tiap Rabu malam yang selalu molor sampai larut.',
    );
    await sendButton(page).click();
    const retry = log(page).getByRole('button', { name: 'Kirim ulang' });
    await expect(retry).toBeVisible();
    await log(page).getByRole('button', { name: 'Balas' }).last().click();
    await expect(chip(page)).toBeVisible();
    await expect(retry).toBeInViewport({ ratio: 1 });
    // Nothing covers it: the sticky bar starts below the button.
    const button = (await retry.boundingBox())!;
    const bar = (await page.locator('.g-chat-bar').boundingBox())!;
    expect(bar.y).toBeGreaterThanOrEqual(button.y + button.height);
  });

  test('an error acknowledgement: Gagal at once', async ({ page, api }) => {
    canRead(api);
    api.socket.answer('message', () => ({ ok: false, error: 'server' }));
    await openR1(page);
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(
      log(page).getByText('Gagal', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      log(page).getByRole('button', { name: 'Kirim ulang' }).first(),
    ).toBeVisible();
  });

  test('the connection drops: the banner, a send fails at once; back: refetched, Kirim ulang delivers', async ({
    page,
    api,
  }, testInfo) => {
    canRead(api);
    await openR1Connected(page, api);
    const fetched = api.calls('GET /api/curhat/chatrooms').length;
    // Review M1: the live region is there before the text, so the text is announced when it comes.
    const status = page.locator('.g-chat-bar [role="status"]');
    await expect(status).toBeAttached();
    await expect(status).toBeEmpty();
    api.socket.drop();
    await expect(status).toHaveText(
      'Koneksi Curhat terputus. Menyambungkan lagi…',
    );
    // Review M1: in view where the room opens, at its newest message, and the newest message still in view.
    await expect(
      page.getByText('Koneksi Curhat terputus. Menyambungkan lagi…'),
    ).toBeInViewport({ ratio: 1 });
    await expectAtNewest(page, M4);
    await strictGates(page, testInfo, 'curhat-dropped');
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
    // Nothing was handed to socket.io, so nothing goes out later.
    expect(api.socket.emitted('message')).toEqual([]);

    api.socket.restore();
    await page.clock.fastForward(6_000);
    await expect(
      page.getByText('Koneksi Curhat terputus. Menyambungkan lagi…'),
    ).toHaveCount(0, { timeout: 15_000 });
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms').length)
      .toBeGreaterThan(fetched);
    // Still failed after the catch-up: only Kirim ulang sends it.
    expect(api.socket.emitted('message')).toEqual([]);
    await log(page).getByRole('button', { name: 'Kirim ulang' }).click();
    await expect(bubble(page, MINE)).toContainText('Terkirim · 13.35');
    expect(api.socket.emitted('message')).toHaveLength(1);
  });

  test('offline, the banner is in view at the newest message of a room', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    await expectAtNewest(page, M4);
    await api.setOffline(true);
    await expect(page.getByText('Offline · diperbarui 13.35')).toBeInViewport({
      ratio: 1,
    });
    await expectAtNewest(page, M4);
    await api.setOffline(false);
    await expect(page.getByText(/^Offline/)).toHaveCount(0);
  });

  // Saved by the server, the acknowledgement lost.
  test('saved, its acknowledgement lost: Gagal, then Kirim ulang shows it once and saves it once', async ({
    page,
    api,
    db,
  }) => {
    canRead(api);
    api.socket.saveWithoutAnswer();
    await openR1Connected(page, api);
    const fetched = api.calls('GET /api/curhat/chatrooms').length;
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(bubble(page, MINE)).toContainText('Mengirim');
    await page.clock.fastForward(10_500);
    await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
    // The server has it already.
    expect(
      db.chatrooms.r1.messages!.filter((m) => m.content === MINE),
    ).toHaveLength(1);
    // Nothing fetched the rooms in between, so only Kirim ulang can settle it.
    expect(api.calls('GET /api/curhat/chatrooms')).toHaveLength(fetched);

    api.socket.answerAsApi('message');
    await log(page).getByRole('button', { name: 'Kirim ulang' }).click();
    await expect(bubble(page, MINE)).toContainText('Terkirim · 13.35');
    await expect(bubble(page, MINE)).toHaveCount(1);
    await expect(log(page).getByText('Gagal', { exact: true })).toHaveCount(0);
    // Sent twice with one device id; saved once.
    const sent = api.socket.emitted('message').map((e) => e.data);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual(payload(MINE));
    expect(sent[1]).toEqual(sent[0]);
    expect(
      db.chatrooms.r1.messages!.filter((m) => m.content === MINE),
    ).toHaveLength(1);
    // Fetched again, the room still shows it once.
    await page.reload();
    await expect(bubble(page, MINE)).toHaveCount(1);
  });

  test('saved, then the connection drops before the answer: back, it shows once, delivered, with no resend', async ({
    page,
    api,
    db,
  }) => {
    canRead(api);
    api.socket.saveWithoutAnswer();
    await openR1(page);
    await expect
      .poll(() => [...api.socket.sessions.values()].some((s) => s.connected))
      .toBe(true);
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect.poll(() => api.socket.emitted('message').length).toBe(1);
    api.socket.drop();
    await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
    api.socket.restore();
    await page.clock.fastForward(6_000);
    // The catch-up fetch brings the server's copy, with this device's id: one bubble, delivered.
    await expect(bubble(page, MINE)).toContainText('Terkirim · 13.35', {
      timeout: 15_000,
    });
    await expect(bubble(page, MINE)).toHaveCount(1);
    await expect(log(page).getByText('Gagal', { exact: true })).toHaveCount(0);
    await expect(
      log(page).getByRole('button', { name: 'Kirim ulang' }),
    ).toHaveCount(0);
    expect(api.socket.emitted('message')).toHaveLength(1);
    expect(
      db.chatrooms.r1.messages!.filter((m) => m.content === MINE),
    ).toHaveLength(1);
  });

  // A rooms fetch that started before the save lands with the older list.
  test('a delivered message stays when a rooms fetch that started earlier lands without it', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1Connected(page, api);
    const fetched = api.calls('GET /api/curhat/chatrooms').length;
    // The next rooms fetch takes the list as it is now, before the message, and answers only once released. That
    // list also has an older Welfare message this page hasn't seen, so we know when it has landed.
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    const OLDER = 'Pesan dari daftar yang lebih lama.';
    api.on('GET /api/curhat/chatrooms', async ({ db }) => {
      const older = JSON.parse(
        JSON.stringify(db.chatrooms),
      ) as typeof db.chatrooms;
      older.r1.messages = [
        {
          id: 'm-older',
          chatroomId: 'r1',
          replyId: null,
          content: OLDER,
          createdAt: '2026-10-08T06:30:00.000Z',
          isSender: false,
          fromOwner: false,
          clientMessageId: null,
        },
        ...older.r1.messages!,
      ];
      await held;
      return older;
    });
    // A Welfare reply in a room this page doesn't know makes it fetch the rooms again.
    api.socket.emit('reply', {
      id: 'm-elsewhere',
      chatroomId: 'r-elsewhere',
      replyId: null,
      content: 'Halo',
      createdAt: NOW,
      isSender: false,
      clientMessageId: null,
    });
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms').length)
      .toBe(fetched + 1);
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(bubble(page, MINE)).toContainText('Terkirim · 13.35');
    release();
    await expect(bubble(page, OLDER)).toBeVisible();
    await expect(bubble(page, MINE)).toHaveCount(1);
    await expect(bubble(page, MINE)).toContainText('Terkirim · 13.35');
    await expectAtNewest(page, MINE);
  });

  // Refusals Kirim ulang can't get past.
  test('refused as forbidden (the room was deleted elsewhere): the rooms are fetched again and it is not found', async ({
    page,
    api,
    db,
  }) => {
    canRead(api);
    await openR1Connected(page, api);
    delete db.chatrooms.r1;
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(
      main(page).getByRole('heading', { name: 'Ruang tidak ditemukan' }),
    ).toBeAttached();
    await expect(
      main(page).getByText('Ruang tidak ditemukan').last(),
    ).toBeVisible();
  });

  test('refused as unauthorized (the session is gone): the session is checked and sign-in takes over', async ({
    page,
    api,
    db,
  }) => {
    canRead(api);
    const requests = apiInFlight(page);
    await openR1(page);
    await expect
      .poll(() => [...api.socket.sessions.values()].some((s) => s.connected))
      .toBe(true);
    await requests.quiet();
    db.signedIn = false;
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(page).toHaveURL(/\/login/);
  });

  // At session expiry the API ends the connection; socket.io doesn't reconnect by itself.
  test('the server ends the connection: the session is checked; still signed in, it connects again and sends', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    await expect
      .poll(() => [...api.socket.sessions.values()].some((s) => s.connected))
      .toBe(true);
    const checks = api.calls('GET /api/me').length;
    api.socket.endSessions();
    await expect
      .poll(() => api.calls('GET /api/me').length)
      .toBeGreaterThan(checks);
    await expect
      .poll(() => [...api.socket.sessions.values()].some((s) => s.connected))
      .toBe(true);
    await expect(
      page.getByText('Koneksi Curhat terputus. Menyambungkan lagi…'),
    ).toHaveCount(0);
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(bubble(page, MINE)).toContainText('Terkirim · 13.35');
  });

  test('the server ends the connection and the session is gone: sign-in takes over', async ({
    page,
    api,
    db,
  }) => {
    canRead(api);
    await openR1(page);
    await expect
      .poll(() => [...api.socket.sessions.values()].some((s) => s.connected))
      .toBe(true);
    db.signedIn = false;
    api.socket.endSessions();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a message sent after Back and reopening the room is emitted and delivered', async ({
    page,
    api,
  }) => {
    canRead(api);
    await page.goto('/layanan/curhat');
    await row(page, 'Teal Koala').click();
    await expect(log(page)).toBeVisible();
    await page.goBack();
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await row(page, 'Teal Koala').click();
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(bubble(page, MINE)).toContainText('Terkirim');
    expect(api.socket.emitted('message').map((e) => e.data)).toEqual([
      payload(MINE),
    ]);
  });

  test('failed messages stay while moving between the list and the room', async ({
    page,
    api,
  }) => {
    canRead(api);
    api.socket.answer('message', () => ({ ok: false, error: 'server' }));
    await page.goto('/layanan/curhat');
    await row(page, 'Teal Koala').click();
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
    await page.goBack();
    await row(page, 'Teal Koala').click();
    await expect(bubble(page, MINE)).toBeVisible();
    await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
  });
});

test.describe('Welfare’s replies', () => {
  const welfare = (id: string, chatroomId: string, content: string) => ({
    id,
    chatroomId,
    replyId: null,
    content,
    createdAt: NOW,
    isSender: false,
    clientMessageId: null,
  });

  test('in the open room: shown at the newest message, and read at once', async ({
    page,
    api,
    db,
  }) => {
    canRead(api);
    await openR1(page);
    await expect
      .poll(() => api.calls('POST /api/curhat/chatroom/:chatroomId/read'))
      .toHaveLength(1);
    const text = 'Siap, aku kirim draf jadwalnya malam ini ya.';
    await expect
      .poll(() =>
        [...api.socket.sessions.values()].some(
          (s) => s.connected && s.rooms.has('r1'),
        ),
      )
      .toBe(true);
    // Saved, then relayed, as the server does: a read of the rooms on its way is made again and must find it.
    db.chatrooms.r1.messages = [
      { ...welfare('m9', 'r1', text), fromOwner: false },
      ...db.chatrooms.r1.messages!,
    ];
    expect(
      api.socket.emit('reply', welfare('m9', 'r1', text), (s) =>
        s.rooms.has('r1'),
      ),
    ).toBe(1);
    await expect(bubble(page, text)).toContainText('Welfare · 13.35');
    await expectAtNewest(page, text);
    await expect
      .poll(() => api.calls('POST /api/curhat/chatroom/:chatroomId/read'))
      .toHaveLength(2);
  });

  // The server sends a connection nothing saved before it joined the room, and the room was read before that.
  test('saved while the connection was still being made: shown in the open room once it connects, and read there', async ({
    page,
    api,
    db,
  }) => {
    canRead(api);
    api.socket.hold();
    await page.goto('/layanan/curhat');
    await row(page, 'Teal Koala').click();
    await expect(bubble(page, M4)).toBeVisible();
    await expect.poll(() => api.socket.heldHandshakes).toBe(1);
    // Opening the room has read it; what is saved next is new.
    await expect
      .poll(() => api.calls('POST /api/curhat/chatroom/:chatroomId/read'))
      .toHaveLength(1);
    const text = 'Siap, aku kirim draf jadwalnya malam ini ya.';
    db.chatrooms.r1.messages = [
      { ...welfare('m9', 'r1', text), fromOwner: false },
      ...db.chatrooms.r1.messages!,
    ];
    expect(
      api.socket.emit('reply', welfare('m9', 'r1', text), (s) =>
        s.rooms.has('r1'),
      ),
    ).toBe(0);
    api.socket.release();
    await expect(bubble(page, text)).toContainText('Welfare · 13.35');
    await expect(bubble(page, text)).toHaveCount(1);
    await expectAtNewest(page, text);
    // Shown in the open room, so read there, as a reply over the socket is.
    await expect.poll(() => db.chatroomReads).toContain('m9');
    await expect
      .poll(() => api.calls('POST /api/curhat/chatroom/:chatroomId/read'))
      .toHaveLength(2);
    await page.goBack();
    await expect(row(page, 'Teal Koala')).toHaveAccessibleName(
      `Teal Koala Welfare: ${text} 13.35`,
    );
  });

  test('saved while the list’s first read was on its way and the connection was being made: read again once it connects', async ({
    page,
    api,
    db,
  }) => {
    api.socket.hold();
    // The first rooms read takes the list as it is now and answers only once released; later reads answer as usual.
    let reads = 0;
    let answer: () => void = () => undefined;
    const answered = new Promise<void>((r) => (answer = r));
    api.on('GET /api/curhat/chatrooms', async ({ db }) => {
      if (++reads > 1) return db.chatrooms;
      const before = JSON.parse(
        JSON.stringify(db.chatrooms),
      ) as typeof db.chatrooms;
      await answered;
      return before;
    });
    await page.goto('/layanan/curhat');
    await expect.poll(() => reads).toBe(1);
    await expect.poll(() => api.socket.heldHandshakes).toBe(1);
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms/unread').length)
      .toBe(1);
    const text = 'Siap, aku kirim draf jadwalnya malam ini ya.';
    db.chatrooms.r1.messages = [
      { ...welfare('m9', 'r1', text), fromOwner: false },
      ...db.chatrooms.r1.messages!,
    ];
    api.socket.release();
    // Connected: the counts are read again, so the page has heard the connection.
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms/unread').length)
      .toBe(2);
    answer();
    await expect(row(page, 'Teal Koala')).toContainText(`Welfare: ${text}`);
  });

  test('on the list: the room moves up with its preview and count', async ({
    page,
    api,
    db,
  }) => {
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Amber Heron')).toBeVisible();
    await expect
      .poll(() => [...api.socket.sessions.values()].some((s) => s.connected))
      .toBe(true);
    const message = welfare('m9', 'r2', 'Gimana kabarnya minggu ini?');
    // Saved, then relayed, as the server does: a read on its way is made again and must find it.
    db.chatrooms.r2.messages = [
      { ...message, fromOwner: false },
      ...db.chatrooms.r2.messages!,
    ];
    api.socket.emit('reply', message, (s) => s.rooms.has('r2'));
    await expect(roomLinks(page).first()).toHaveAccessibleName(
      'Amber Heron , 1 pesan baru Welfare: Gimana kabarnya minggu ini? 13.35',
    );
  });

  // The connection's catch-up read can be answered with the rooms and counts as they were just before a reply was
  // saved, and land after the reply itself.
  test('on the list: a reply that arrives while the catch-up read is on its way keeps its preview and count', async ({
    page,
    api,
    db,
  }) => {
    // The connection waits until the list's first reads have landed; the reads it then makes are held.
    api.socket.hold();
    let holding = false;
    let release: () => void = () => undefined;
    const released = new Promise<void>((r) => (release = r));
    const held = { rooms: 0, counts: 0 };
    const holdOnceConnected = (route: keyof typeof held, path: string) => {
      const answer = defaultHandlers[path];
      api.on(path, async (ctx) => {
        const now = answer(ctx);
        if (holding) {
          held[route]++;
          await released;
        }
        return now;
      });
    };
    holdOnceConnected('rooms', 'GET /api/curhat/chatrooms');
    holdOnceConnected('counts', 'GET /api/curhat/chatrooms/unread');
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Teal Koala')).toHaveAccessibleName(/1 pesan baru/);
    await expect.poll(() => api.socket.heldHandshakes).toBe(1);
    holding = true;
    api.socket.release();
    await expect.poll(() => [held.rooms, held.counts]).toEqual([1, 1]);
    const text = 'Gimana kabarnya minggu ini?';
    db.chatrooms.r2.messages = [
      { ...welfare('m9', 'r2', text), fromOwner: false },
      ...db.chatrooms.r2.messages!,
    ];
    expect(
      api.socket.emit('reply', welfare('m9', 'r2', text), (s) =>
        s.rooms.has('r2'),
      ),
    ).toBe(1);
    const fresh = `Amber Heron , 1 pesan baru Welfare: ${text} 13.35`;
    await expect(roomLinks(page).first()).toHaveAccessibleName(fresh);
    holding = false;
    release();
    // Read again: the held answers lack the reply, so only a read made after it shows it.
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms/unread').length)
      .toBe(3);
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms').length)
      .toBe(3);
    await expect(roomLinks(page).first()).toHaveAccessibleName(fresh);
  });
});

test.describe('deleting a room', () => {
  test('it asks first; Batal keeps the room', async ({
    page,
    api,
  }, testInfo) => {
    canRead(api);
    await openR1(page);
    await deleteButton(page, testInfo).click();
    const dialog = page.getByRole('alertdialog', { name: 'Hapus ruang ini?' });
    await expect(dialog).toContainText(
      'Seluruh percakapan di ruang ini hilang, juga untuk tim Welfare.',
    );
    await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused();
    await strictGates(page, testInfo, 'curhat-delete-confirm');
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(log(page)).toBeVisible();
    expect(api.calls('DELETE /api/curhat/chatroom/:chatroomId')).toEqual([]);
  });

  test('confirming deletes it, back to the list with the toast; Back can’t return; its link says not found', async ({
    page,
    api,
  }, testInfo) => {
    canRead(api);
    api.on('DELETE /api/curhat/chatroom/:chatroomId', writes.deleteRoom);
    await page.goto('/layanan/curhat');
    await row(page, 'Teal Koala').click();
    await expect(log(page)).toBeVisible();
    await deleteButton(page, testInfo).click();
    await page
      .getByRole('alertdialog', { name: 'Hapus ruang ini?' })
      .getByRole('button', { name: 'Hapus ruang' })
      .click();
    await expect(page).toHaveURL(/\/layanan\/curhat$/);
    await expect(toastText(page, 'Ruang dihapus.')).toBeVisible();
    await expect(row(page, 'Amber Heron')).toBeVisible();
    await expect(row(page, 'Teal Koala')).toHaveCount(0);
    await expect(main(page).getByText('1 dari 3 ruang dipakai')).toBeVisible();
    expect(api.calls('DELETE /api/curhat/chatroom/:chatroomId')[0].path).toBe(
      '/api/curhat/chatroom/r1',
    );
    await expect(
      page.locator('[data-page-title]').locator('visible=true'),
    ).toBeFocused();
    await page.goBack();
    await expect(page).not.toHaveURL(/\/layanan\/curhat\/r1$/);

    await page.goto('/layanan/curhat/r1');
    await expect(
      main(page).getByRole('heading', { name: 'Ruang tidak ditemukan' }),
    ).toBeAttached();
    await expect(
      main(page).getByText('Ruang ini sudah dihapus.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'curhat-not-found');
    await main(page)
      .getByRole('button', { name: 'Kembali ke Curhat Yuk!' })
      .click();
    await expect(page).toHaveURL(/\/layanan\/curhat$/);
  });

  test('a failed delete keeps the room and says so', async ({
    page,
    api,
  }, testInfo) => {
    canRead(api);
    api.on('DELETE /api/curhat/chatroom/:chatroomId', reply.status(500));
    await openR1(page);
    await deleteButton(page, testInfo).click();
    await page
      .getByRole('alertdialog', { name: 'Hapus ruang ini?' })
      .getByRole('button', { name: 'Hapus ruang' })
      .click();
    await expect(
      toastText(page, 'Ruang gagal dihapus. Coba lagi.'),
    ).toBeVisible();
    await expect(log(page)).toBeVisible();
  });
});

test.describe('Enter', () => {
  test('on a touch keyboard Enter starts a new line and doesn’t send @phone-only', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    await composer(page).click();
    await page.keyboard.type('baris satu');
    await page.keyboard.press('Enter');
    await page.keyboard.type('baris dua');
    await expect(composer(page)).toHaveValue('baris satu\nbaris dua');
    expect(api.socket.emitted('message')).toEqual([]);
    // The field grew to fit both lines.
    const h = (await composer(page).boundingBox())!.height;
    expect(h).toBeGreaterThan(60);
    await sendButton(page).click();
    await expect(bubble(page, 'baris dua')).toContainText('Terkirim');
    expect(api.socket.emitted('message')[0].data).toMatchObject({
      message: 'baris satu\nbaris dua',
    });
  });

  test('with a mouse and keyboard Enter sends, Shift+Enter starts a new line @desktop-only', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    await composer(page).click();
    await page.keyboard.type('satu');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('dua');
    await expect(composer(page)).toHaveValue('satu\ndua');
    expect(api.socket.emitted('message')).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(bubble(page, 'dua')).toContainText('Terkirim');
    await expect(composer(page)).toHaveValue('');
    await expect(composer(page)).toBeFocused();
  });

  test('the field grows to five lines, then scrolls', async ({ page, api }) => {
    canRead(api);
    await openR1(page);
    const rest = (await composer(page).boundingBox())!.height;
    expect(rest).toBe(44);
    await composer(page).fill(
      Array.from({ length: 9 }, (_, i) => `baris ${i}`).join('\n'),
    );
    await expect
      .poll(async () => (await composer(page).boundingBox())!.height)
      .toBe(140);
  });
});

test.describe('states', () => {
  test('loading: list-row skeletons after 300 ms', async ({ page, api }) => {
    api.on('GET /api/curhat/chatrooms', reply.hang());
    await page.goto('/layanan/curhat');
    await expect(
      page.getByRole('status', { name: 'Memuat ruang…' }),
    ).toBeVisible();
  });

  test('an error with Coba lagi', async ({ page, api }, testInfo) => {
    let fail = true;
    api.on('GET /api/curhat/chatrooms', ({ db }) =>
      fail ? reply.status(503) : db.chatrooms,
    );
    await page.goto('/layanan/curhat');
    const alert = main(page).getByRole('alert');
    await expect(alert).toContainText('Ruang cerita gagal dimuat.', {
      timeout: 20_000,
    });
    await strictGates(page, testInfo, 'curhat-error');
    fail = false;
    await alert.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(row(page, 'Teal Koala')).toBeVisible();
  });

  test('offline: the banner with the last update over the rooms already loaded', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await api.setOffline(true);
    await expect(
      main(page).getByText('Offline · diperbarui 13.35'),
    ).toBeVisible();
    await expect(row(page, 'Amber Heron')).toBeVisible();
    await strictGates(page, testInfo, 'curhat-offline');
    await api.setOffline(false);
    await expect(main(page).getByText(/^Offline/)).toHaveCount(0);
  });
});

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test('a link to a room leads to sign-in, then into the room', async ({
    page,
    api,
  }) => {
    // Sign-in, with the harness's fake Google script.
    await fakeGoogle(page.context());
    canRead(api);
    await page.goto('/layanan/curhat/r1');
    await expect(page).toHaveURL(/\/login\?redirect=%2Flayanan%2Fcurhat%2Fr1$/);
    expect(api.calls('GET /api/curhat/chatrooms')).toHaveLength(0);
    api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
    await expect
      .poll(async () => (await googleRequests(page)).clients.length)
      .toBe(1);
    await page.getByRole('button', { name: 'Masuk dengan Google' }).click();
    await expect(page).toHaveURL(/\/layanan\/curhat\/r1$/);
    await expect(log(page)).toBeVisible();
  });
});

// Welfare answers in the
// inbox at /kelola/curhat (journeys/curhat-inbox.spec.ts), and the member area sends them there.
test.describe('Welfare', () => {
  test.use({ persona: 'pengurus', roles: ['curhatadmin'] });

  test('the member area sends Welfare to the inbox, a room to the same room, replacing the entry', async ({
    page,
    api,
  }) => {
    canRead(api);
    await page.goto('/layanan');
    await page.goto('/layanan/curhat');
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
    await expect(newRoom(page)).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/layanan$/);
    await page.goto('/layanan/curhat/r1');
    await expect(page).toHaveURL(/\/kelola\/curhat\/r1$/);
    await expect(log(page)).toBeVisible();
    // No member connection: only the inbox's, which joins every room (each page load opened one; the fake doesn't
    // notice a page that went away).
    await expect
      .poll(() => [
        ...new Set(
          [...api.socket.sessions.values()]
            .filter((s) => s.connected)
            .map((s) => [...s.rooms].sort().join(' ')),
        ),
      ])
      .toEqual(['curhat:welfare r1 r2']);
  });
});

test.describe('the chat layout', () => {
  const scroller = (page: Page) =>
    page.locator('[data-scroll-restoration-id="isi"]');
  /** The room's head: the top bar on phones and tablets, the page head on desktop. */
  const head = (page: Page, t: TestInfo) =>
    isDesk(t) ? main(page).locator('.g-d-head') : page.locator('.g-top');

  test('a short thread: the composer ends at the bottom of the screen, the messages sit just above it', async ({
    page,
    api,
  }) => {
    canRead(api);
    await page.goto('/layanan/curhat/r2');
    await expect(log(page, 'Amber Heron')).toBeVisible();
    const height = page.viewportSize()!.height;
    const bar = (await page.locator('.g-chat-bar').boundingBox())!;
    expect(Math.abs(bar.y + bar.height - height)).toBeLessThanOrEqual(1);
    // From the bottom, as in a chat: the newest bubble right above the composer, not under the head.
    const last = (await log(page, 'Amber Heron')
      .locator('.g-bubble')
      .filter({ hasText: 'Sama-sama! Kapan pun mau cerita lagi' })
      .boundingBox())!;
    expect(bar.y - (last.y + last.height)).toBeLessThanOrEqual(24);
    // Nothing to scroll.
    expect(
      await scroller(page).evaluate((el) => el.scrollHeight - el.clientHeight),
    ).toBeLessThanOrEqual(1);
  });

  test('a new room: the composer at the bottom of the screen, the first-message hint above it', async ({
    page,
    api,
    db,
  }) => {
    canRead(api);
    db.chatrooms.r2.messages = [];
    await page.goto('/layanan/curhat/r2');
    await expect(composer(page)).toBeVisible();
    const bar = (await page.locator('.g-chat-bar').boundingBox())!;
    expect(
      Math.abs(bar.y + bar.height - page.viewportSize()!.height),
    ).toBeLessThanOrEqual(1);
    const hint = (await main(page)
      .getByText('Tulis pesan pertamamu. Tim Welfare membalas di sini.')
      .boundingBox())!;
    expect(bar.y - (hint.y + hint.height)).toBeLessThanOrEqual(48);
  });

  test('a long thread: the head and the composer stay on screen while you read back', async ({
    page,
    api,
    db,
  }, testInfo) => {
    canRead(api);
    const base = Date.parse(NOW) - 60 * 60_000;
    db.chatrooms.r1.messages = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `m-many-${i}`,
        chatroomId: 'r1',
        replyId: null,
        content: `Pesan ke-${i + 1}`,
        createdAt: new Date(base + i * 10 * 60_000).toISOString(),
        isSender: i % 2 === 0,
        fromOwner: i % 2 === 0,
        clientMessageId: null,
      })),
      ...db.chatrooms.r1.messages!,
    ];
    await openR1(page);
    await scroller(page).evaluate((el) => (el.scrollTop = 0));
    await expect(bubble(page, M1)).toBeInViewport();
    await expect(head(page, testInfo)).toBeInViewport({ ratio: 1 });
    await expect(
      isDesk(testInfo)
        ? main(page).getByRole('button', { name: 'Hapus ruang' })
        : page.getByRole('button', { name: 'Hapus ruang ini' }),
    ).toBeInViewport({ ratio: 1 });
    await expect(composer(page)).toBeInViewport({ ratio: 1 });
    const top = (await head(page, testInfo).boundingBox())!;
    expect(top.y).toBeGreaterThanOrEqual(0);
    // The middle of the thread, too.
    await scroller(page).evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
    await expect(head(page, testInfo)).toBeInViewport({ ratio: 1 });
    await expect(composer(page)).toBeInViewport({ ratio: 1 });
    if (isDesk(testInfo))
      await expect(
        main(page).getByRole('link', { name: 'Curhat Yuk!' }),
      ).toBeInViewport({ ratio: 1 });
  });

  test('messages close together group: tight spacing and the time once, on the last', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    // Acknowledged as the API does, both at the same minute.
    for (const text of ['Satu', 'Dua']) {
      await composer(page).fill(text);
      await sendButton(page).click();
      await expect(bubble(page, text)).toContainText('Terkirim');
    }
    // The first one's time is the group's, shown on the last.
    await expect(bubble(page, 'Satu')).toHaveText('Kamu: Satu');
    await expect(bubble(page, 'Dua')).toHaveText('Kamu: DuaTerkirim · 13.35');
    const a = (await bubble(page, 'Satu').boundingBox())!;
    const b = (await bubble(page, 'Dua').boundingBox())!;
    expect(b.y - (a.y + a.height)).toBeLessThanOrEqual(4);
    // A new side starts a new group, with more room.
    const m4 = (await bubble(page, M4).boundingBox())!;
    expect(a.y - (m4.y + m4.height)).toBeGreaterThanOrEqual(10);
  });

  test('no Balas text under the bubbles: Balas is an icon beside each, shown on hover and on focus @desktop-only', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    await expect(log(page).getByText('Balas', { exact: true })).toHaveCount(0);
    const reply = log(page).getByRole('button', { name: 'Balas' }).last();
    const opacity = () =>
      reply.evaluate((el) => Number(getComputedStyle(el).opacity));
    await expect.poll(opacity).toBe(0);
    await bubble(page, M4).hover();
    await expect.poll(opacity).toBe(1);
    // Beside the bubble, on the same line.
    const r = (await reply.boundingBox())!;
    const m = (await bubble(page, M4).boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(m.x + m.width);
    expect(r.y + r.height / 2).toBeGreaterThan(m.y);
    expect(r.y + r.height / 2).toBeLessThan(m.y + m.height);
    await reply.click();
    await expect(chip(page)).toHaveText(`Membalas: ${M4}`);
    await page.mouse.move(0, 0);
    await reply.focus();
    await expect.poll(opacity).toBe(1);
  });

  test('touch: swiping a bubble replies to it; a tap shows Balas @phone-only', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    // Your own m3 is the first bubble with its text (m4 quotes it).
    const swipe = async (text: string, by: number) => {
      const box = (await bubble(page, text).first().boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const ev = (type: string, dx: number) =>
        bubble(page, text)
          .first()
          .dispatchEvent(type, {
            pointerType: 'touch',
            pointerId: 7,
            isPrimary: true,
            clientX: x + dx,
            clientY: y,
          });
      await ev('pointerdown', 0);
      for (const step of [10, 30, by]) await ev('pointermove', step);
      await ev('pointerup', by);
    };
    // Welfare's message to the right.
    await swipe(M4, 70);
    await expect(chip(page)).toHaveText(`Membalas: ${M4}`);
    await expect(composer(page)).toBeFocused();
    await page.getByRole('button', { name: 'Batal membalas' }).click();
    // A short pull isn't a reply.
    await swipe(M4, 30);
    await expect(chip(page)).toHaveCount(0);
    // Your own to the left.
    await swipe(M3, -70);
    await expect(chip(page)).toHaveText(`Membalas: ${M3}`);
    await page.getByRole('button', { name: 'Batal membalas' }).click();
    // A tap shows the icon.
    const reply = log(page)
      .locator('.g-msg')
      .filter({ has: page.locator('.g-bubble', { hasText: M1 }) })
      .getByRole('button', { name: 'Balas' });
    await expect
      .poll(() => reply.evaluate((el) => Number(getComputedStyle(el).opacity)))
      .toBe(0);
    await bubble(page, M1).tap();
    await expect
      .poll(() => reply.evaluate((el) => Number(getComputedStyle(el).opacity)))
      .toBe(1);
    await reply.tap();
    await expect(chip(page)).toHaveText(`Membalas: ${M1}`);
  });
});

test.describe('gates at every size', () => {
  const LONG =
    'Aku pengen cerita panjang soal minggu ini karena rasanya semua tenggat datang bersamaan dan aku belum tahu harus mulai dari mana, apalagi ada rapat kepanitiaan tiap Rabu malam yang selalu molor sampai larut.';

  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`the list, a room with long messages, the reply chip and a failed message, and the empty state at ${width} px @desktop-only`, async ({
      page,
      api,
      db,
    }, testInfo) => {
      canRead(api);
      db.chatrooms.r1.messages = [
        {
          id: 'm-long',
          chatroomId: 'r1',
          replyId: 'm4',
          content: LONG,
          createdAt: NOW,
          isSender: false,
          fromOwner: false,
          clientMessageId: null,
        },
        ...db.chatrooms.r1.messages!,
      ];
      api.socket.answer('message', () => ({ ok: false, error: 'server' }));
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/layanan/curhat');
      await expect(row(page, 'Teal Koala')).toBeVisible();
      await strictGates(page, testInfo, `curhat-list-${width}`);
      await row(page, 'Teal Koala').click();
      await expect(log(page)).toBeVisible();
      await composer(page).fill(LONG);
      await sendButton(page).click();
      await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
      await log(page).getByRole('button', { name: 'Balas' }).last().click();
      await expect(
        page.getByRole('button', { name: 'Batal membalas' }),
      ).toBeVisible();
      await strictGates(page, testInfo, `curhat-room-${width}`);
      db.chatrooms = {};
      await page.goto('/layanan/curhat');
      await expect(
        main(page).getByText('Belum ada ruang cerita'),
      ).toBeVisible();
      await strictGates(page, testInfo, `curhat-empty-${width}`);
    });
  }

  test('at 200 % zoom @desktop-only', async ({ page, api }, testInfo) => {
    canRead(api);
    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await strictGates(page, testInfo, 'curhat-list-zoom');
    await row(page, 'Teal Koala').click();
    await expect(log(page)).toBeVisible();
    await strictGates(page, testInfo, 'curhat-room-zoom');
  });

  test('touch: inputs 16 px, the composer’s targets 44 px @phone-only', async ({
    page,
    api,
  }) => {
    canRead(api);
    await openR1(page);
    expect(
      await composer(page).evaluate((el) => getComputedStyle(el).fontSize),
    ).toBe('16px');
    for (const target of [composer(page), sendButton(page)]) {
      const box = (await target.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('focus is visible at each Tab stop of the list and the room', async ({
    page,
    api,
  }) => {
    canRead(api);
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await expectRingsUntil(page, newRoom(page), 30);
    await row(page, 'Teal Koala').click();
    await expect(log(page)).toBeVisible();
    await expectRingsUntil(page, sendButton(page), 30);
  });

  test('nothing moves after first paint under reduced motion', async ({
    page,
    api,
  }) => {
    canRead(api);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/layanan/curhat');
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await row(page, 'Teal Koala').click();
    await expect(log(page)).toBeVisible();
    const moving = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === 'running')
          .length,
    );
    expect(moving).toBe(0);
  });
});

/** Tab from the page's start until `last` has focus; every stop shows a focus ring. */
async function expectRingsUntil(page: Page, last: Locator, max: number) {
  await page
    .locator('[data-page-title]')
    .locator('visible=true')
    .first()
    .focus();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el.matches(':focus-visible'))
        return `not focus-visible: ${el.outerHTML.slice(0, 120)}`;
      const s = getComputedStyle(el);
      return s.outlineStyle !== 'none' || /\b4px\b/.test(s.boxShadow)
        ? 'ring'
        : `none on ${el.outerHTML.slice(0, 120)}`;
    });
    expect(ring, `Tab stop ${i + 1}`).toBe('ring');
    if (await last.evaluate((b) => b === document.activeElement)) return;
  }
  throw new Error(`not reached within ${max} Tab stops`);
}
