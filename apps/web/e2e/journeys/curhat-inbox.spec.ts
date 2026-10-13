/**
 * Curhat Yuk!'s inbox for HMIF Welfare (P3-C) at /kelola/curhat: a proposal (OPEN-QUESTIONS D9) built from the member
 * side's pieces. Raka with `curhatadmin` is the Welfare member (Nadia owns r1 and r2, so she never is); Nadia, and Raka
 * without the role, are sent away. On the API's protocol as the fake socket speaks it: a Welfare `curhat` handshake
 * joins every room and the Welfare group room; every message says `fromOwner`.
 *
 * The harness's Welfare view (fixtures/NOTES.md): every room, the member's messages `fromOwner`, the prototype's
 * Welfare messages Raka's own; Teal Koala has m1 and m3 unread (2), Amber Heron none.
 */
import type { Page, TestInfo } from '@playwright/test';
import type { ChatroomMessage } from '../../src/api/generated';
import { NOW } from '../fixtures/api';
import { email, PEOPLE } from '../fixtures/prototype';
import { layoutOf } from '../support/app';
import { reply, type ApiMock } from '../support/mock';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

test.use({ persona: 'pengurus', roles: ['curhatadmin'] });

const M4 =
  'Oke, coba kita susun bareng ya. Mau aku bantu bikin jadwal mingguan sampai UTS?';
const M3 = 'Tubes 1 IF2110 Jumat ini, terus rapat kepanitiaan tiap Rabu malam.';
const M1 =
  'Kak, aku lagi kewalahan bagi waktu antara tubes sama kepanitiaan. Normal nggak sih?';
const M6 = 'Sama-sama! Kapan pun mau cerita lagi, ruang ini tetap ada.';
const REPLY = 'Siap, aku kirim jadwalnya ya.';
/** Nadia, who owns both rooms: nothing about her may show or be sent. */
const NADIA = PEOPLE.nadia;
const NADIA_EMAIL = email(NADIA.nim);

const main = (page: Page) => page.getByRole('main');
const touch = (t: TestInfo) => layoutOf(t) !== 'desktop';
const isDesk = (t: TestInfo) => layoutOf(t) === 'desktop';
/** The lit item: Kelola sits in Layanan on phones and tablets, its own sidebar item on desktop. */
const lit = (t: TestInfo) => (touch(t) ? 'Layanan' : 'Kelola');
/** A room is a focused flow: no tab bar or rail on phones and tablets; the sidebar stays on desktop. */
const roomLit = (t: TestInfo) => (touch(t) ? null : 'Kelola');
const roomLinks = (page: Page) =>
  main(page).locator('a[href^="/kelola/curhat/"]');
const row = (page: Page, name: string) =>
  roomLinks(page).filter({ hasText: name });
const options = (page: Page, name: string) =>
  main(page).getByRole('button', { name: `Opsi untuk ${name}` });
/** The room's own options: the top bar's on phones and tablets, the page head's on desktop. */
const roomOptions = (page: Page, t: TestInfo, name = 'Teal Koala') =>
  (isDesk(t) ? main(page) : page.locator('header')).getByRole('button', {
    name: `Opsi untuk ${name}`,
  });
const search = (page: Page) =>
  main(page).getByRole('searchbox', { name: 'Cari ruang curhat' });
const unreadChip = (page: Page) =>
  main(page).getByRole('button', { name: 'Belum dibaca' });
const log = (page: Page, name = 'Teal Koala') =>
  page.getByRole('log', { name: `Percakapan ${name}` });
const composer = (page: Page, name = 'Teal Koala') =>
  page.getByRole('textbox', { name: `Tulis balasan untuk ${name}` });
const sendButton = (page: Page) =>
  page.getByRole('button', { name: 'Kirim pesan' });
const bubble = (page: Page, text: string) =>
  log(page).locator('.g-bubble').filter({ hasText: text });
const toastText = (page: Page, text: string | RegExp) =>
  page.locator('.g-toast-region').getByText(text);
const FAILED = 'Balasan belum terkirim. Coba kirim lagi.';
/** The rooms' names, in the order the list shows them. */
const rowNames = (page: Page) =>
  roomLinks(page).evaluateAll((els) =>
    els.map((el) => el.querySelector('.t-sub')?.firstChild?.textContent ?? ''),
  );

function canRead(api: ApiMock) {
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
}
function canPin(api: ApiMock) {
  api.on('PUT /api/curhat/chatroom/:chatroomId/pin', writes.pinRoom);
}

/** Welfare's connection is up and in every room and the Welfare group room. */
async function socketReady(api: ApiMock) {
  await expect
    .poll(
      () =>
        [...api.socket.sessions.values()].some(
          (s) =>
            s.connected &&
            s.auth.curhat === true &&
            s.rooms.has('curhat:welfare') &&
            s.rooms.has('r1') &&
            s.rooms.has('r2'),
        ),
      // socket.io reconnects with up to 5 s of backoff (plus jitter) after a drop.
      { timeout: 20_000 },
    )
    .toBe(true);
}

async function openInbox(page: Page) {
  await page.goto('/kelola/curhat');
  await expect(row(page, 'Teal Koala')).toBeVisible();
}

async function openR1(page: Page, api: ApiMock) {
  canRead(api);
  await page.goto('/kelola/curhat/r1');
  await expect(log(page)).toBeVisible();
  await socketReady(api);
}

/** A message the room's member writes (Nadia), as the API relays it to Welfare. */
const fromMember = (id: string, chatroomId: string, content: string) => ({
  id,
  chatroomId,
  replyId: null,
  content,
  createdAt: NOW,
  isSender: false,
  fromOwner: true,
  clientMessageId: null,
});

// ---------------------------------------------------------------- Ways in

test.describe('ways in', () => {
  test('Layanan’s Kelola group and the hub have the inbox row; the member row leads there too, with the inbox’s count', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan');
    const kelolaRow = main(page).locator('a[href="/kelola/curhat"]');
    await expect(kelolaRow).toHaveAccessibleName(
      /^Curhat Yuk!.*Balas ruang curhat anggota/,
    );
    // The member row keeps its words, and its count is the inbox's unread total (the API counts every room).
    const memberRow = main(page).locator('a[href="/layanan/curhat"]');
    await expect(memberRow).toContainText(
      'Ngobrol anonim dengan tim Welfare HMIF',
    );
    await expect(memberRow).toHaveAccessibleName(/2 pesan baru/);
    await memberRow.click();
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
    await expect(row(page, 'Teal Koala')).toBeVisible();

    await page.goto('/kelola');
    const hubRow = main(page).getByRole('link', { name: /^Curhat Yuk!/ });
    await expect(hubRow).toHaveAttribute('href', '/kelola/curhat');
    await expect(hubRow).toContainText('Balas ruang curhat anggota');
    await strictGates(page, testInfo, 'inbox-hub', lit(testInfo));
    await hubRow.click();
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
    await expect(page).toHaveTitle('Curhat Yuk! · PIPS!');
  });

  test('/layanan/curhat, a room link and today’s /home/curhat lead to the inbox, replacing the entry', async ({
    page,
    api,
  }) => {
    canRead(api);
    await page.goto('/layanan');
    await page.goto('/layanan/curhat');
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/layanan$/);
    await page.goto('/layanan/curhat/r1');
    await expect(page).toHaveURL(/\/kelola\/curhat\/r1$/);
    await expect(log(page)).toBeVisible();
    // The Welfare push's link (today's path, through P0-B's redirect).
    await page.goto('/home/curhat');
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
    // Today's Welfare screen is gone.
    await expect(page.getByRole('heading', { name: 'Messages' })).toHaveCount(
      0,
    );
  });

  test('global search finds the inbox', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /^Halo/ })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Pencarian global' });
    await palette
      .getByRole('combobox', { name: 'Cari di PIPS!' })
      .fill('balas');
    const option = palette
      .getByRole('option')
      .filter({ hasText: 'Balas ruang curhat anggota' });
    await expect(option).toHaveCount(1);
    await option.click();
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
  });

  // Review, deviation 5 (Dev 1's decision): Welfare saw "Curhat Yuk!" twice, both leading to the inbox.
  test('global search lists Curhat Yuk! once for Welfare: the inbox row', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /^Halo/ })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Pencarian global' });
    await palette
      .getByRole('combobox', { name: 'Cari di PIPS!' })
      .fill('curhat');
    const options = palette
      .getByRole('option')
      .filter({ hasText: 'Curhat Yuk!' });
    await expect(options).toHaveCount(1);
    await expect(options).toContainText('Balas ruang curhat anggota');
    await expect(
      palette.getByRole('option').filter({
        hasText: 'Ngobrol anonim dengan tim Welfare HMIF',
      }),
    ).toHaveCount(0);
    await options.click();
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
  });

  test.describe('a Welfare member with no other tool', () => {
    test.use({ roles: { only: ['curhatadmin'] } });

    test('Kelola is in the sidebar, and the hub and Layanan’s Kelola group hold only the Curhat row', async ({
      page,
    }, testInfo) => {
      if (isDesk(testInfo)) {
        await page.goto('/');
        await expect(
          page
            .getByRole('navigation', { name: 'Navigasi utama' })
            .getByRole('link', { name: /^Kelola/ }),
        ).toBeVisible();
      }
      await page.goto('/kelola');
      const links = main(page).getByRole('list').getByRole('link');
      await expect(links).toHaveCount(1);
      await expect(links).toHaveAccessibleName(/^Curhat Yuk!/);
      await page.goto('/layanan');
      await expect(
        main(page).getByRole('heading', { name: 'Kelola' }),
      ).toBeVisible();
      await expect(main(page).locator('a[href^="/kelola"]')).toHaveCount(1);
      await page.goto('/kelola/curhat');
      await expect(row(page, 'Teal Koala')).toBeVisible();
    });
  });
});

// ---------------------------------------------------------------- Who gets in

test.describe('who gets in', () => {
  const noInboxSocket = (api: ApiMock) =>
    [...api.socket.sessions.values()].filter((s) => s.auth.curhat === true);

  test.describe('Nadia, anggota', () => {
    test.use({ persona: 'anggota', roles: null });

    test('is sent to Layanan from the inbox and its rooms, with no connection and no pin', async ({
      page,
      api,
    }) => {
      for (const path of ['/kelola/curhat', '/kelola/curhat/r1']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/layanan$/);
      }
      await expect(main(page).locator('a[href="/kelola/curhat"]')).toHaveCount(
        0,
      );
      expect(noInboxSocket(api)).toEqual([]);
      expect(api.calls('GET /api/curhat/chatrooms')).toEqual([]);
      expect(api.writes).toEqual([]);
    });

    test('global search still lists the member Curhat Yuk!', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /^Halo/ })).toBeVisible();
      await page.keyboard.press('ControlOrMeta+k');
      const palette = page.getByRole('dialog', { name: 'Pencarian global' });
      await palette
        .getByRole('combobox', { name: 'Cari di PIPS!' })
        .fill('curhat');
      const options = palette
        .getByRole('option')
        .filter({ hasText: 'Curhat Yuk!' });
      await expect(options).toHaveCount(1);
      await expect(options).toContainText(
        'Ngobrol anonim dengan tim Welfare HMIF',
      );
    });
  });

  test.describe('Raka without curhatadmin', () => {
    test.use({ roles: null });

    test('is sent to Kelola, which has no Curhat row', async ({
      page,
      api,
    }) => {
      for (const path of ['/kelola/curhat', '/kelola/curhat/r1']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/kelola$/);
      }
      await expect(main(page).locator('a[href="/kelola/curhat"]')).toHaveCount(
        0,
      );
      expect(noInboxSocket(api)).toEqual([]);
      expect(api.calls('GET /api/curhat/chatrooms')).toEqual([]);
    });
  });

  test('a role taken away: the pin’s 401 says so, nobody is signed out, the gate sends Raka to Kelola', async ({
    page,
    api,
    db,
  }) => {
    canPin(api);
    await openInbox(page);
    const checks = api.calls('GET /api/me').length;
    await options(page, 'Amber Heron').click();
    const item = page.getByRole('menuitem', { name: 'Sematkan ruang' });
    await expect(item).toBeVisible();
    // An admin takes the role away; the pin now answers 401.
    db.me!.roles = db.me!.roles.filter((r) => r !== 'curhatadmin');
    await item.click();
    await expect(
      toastText(page, 'Kamu tidak punya akses untuk menyematkan ruang ini.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/kelola$/);
    expect(api.calls('GET /api/me').length).toBeGreaterThan(checks);
    await expect(page).not.toHaveURL(/\/login/);
    // Still signed in, with his other tools.
    await expect(main(page).getByRole('list').getByRole('link')).toHaveCount(3);
  });

  test('a role taken away while replying: refused as forbidden, no toast, the gate sends Raka on', async ({
    page,
    api,
    db,
  }) => {
    await openR1(page, api);
    db.me!.roles = db.me!.roles.filter((r) => r !== 'curhatadmin');
    api.socket.answer('message', () => ({ ok: false, error: 'forbidden' }));
    await composer(page).fill(REPLY);
    await sendButton(page).click();
    await expect(page).toHaveURL(/\/kelola$/);
    await expect(toastText(page, FAILED)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------- The list

test.describe('the list', () => {
  test('every room, newest first, with previews, times and counts; the connection joins every room', async ({
    page,
    api,
  }, testInfo) => {
    await openInbox(page);
    expect(await rowNames(page)).toEqual(['Teal Koala', 'Amber Heron']);
    await expect(row(page, 'Teal Koala')).toHaveAccessibleName(
      `Teal Koala , 2 pesan baru Kamu: ${M4} 10.12`,
    );
    await expect(row(page, 'Amber Heron')).toHaveAccessibleName(
      `Amber Heron Kamu: ${M6} Sen 14 Sep`,
    );
    await expect(row(page, 'Teal Koala').locator('.g-count')).toHaveText('2');
    await expect(row(page, 'Amber Heron').locator('.g-count')).toHaveCount(0);
    // The member's things aren't Welfare's: no privacy note, no start-a-room button.
    await expect(main(page).getByText('Anonim.')).toHaveCount(0);
    await expect(
      main(page).getByRole('button', { name: 'Mulai ruang baru' }),
    ).toHaveCount(0);
    await expect(main(page).getByRole('heading', { level: 2 })).toHaveCount(0);
    await expect(page).toHaveTitle('Curhat Yuk! · PIPS!');
    await socketReady(api);
    const session = [...api.socket.sessions.values()].find(
      (s) => s.auth.curhat === true,
    )!;
    expect([...session.rooms].sort()).toEqual(['curhat:welfare', 'r1', 'r2']);
    await strictGates(page, testInfo, 'inbox-list', lit(testInfo));
  });

  test('the member’s last message reads "Anggota: …", a teammate’s "Welfare: …"', async ({
    page,
    db,
  }) => {
    db.chatrooms.r1.messages = [
      fromMember('m-new', 'r1', 'Mau kak, makasih banyak.'),
      ...db.chatrooms.r1.messages!,
    ];
    db.chatrooms.r2.messages = [
      {
        ...fromMember('m-mate', 'r2', 'Kabari kami kalau perlu ya.'),
        fromOwner: false,
      },
      ...db.chatrooms.r2.messages!,
    ];
    await openInbox(page);
    await expect(row(page, 'Teal Koala')).toContainText(
      'Anggota: Mau kak, makasih banyak.',
    );
    await expect(row(page, 'Amber Heron')).toContainText(
      'Welfare: Kabari kami kalau perlu ya.',
    );
  });

  test('search by a word from a message, from the first character, in the URL; no match', async ({
    page,
  }, testInfo) => {
    await openInbox(page);
    await search(page).pressSequentially('l');
    await expect(page).toHaveURL(/[?&]q=l\b/);
    await search(page).fill('LEGA');
    await expect(roomLinks(page)).toHaveCount(1);
    await expect(row(page, 'Amber Heron')).toBeVisible();
    await expect(page).toHaveURL(/[?&]q=LEGA/);
    // Enter does nothing (no form).
    await search(page).press('Enter');
    await expect(page).toHaveURL(/\/kelola\/curhat\?q=LEGA$/);
    // A word from the member's message in Teal Koala.
    await search(page).fill('kepanitiaan');
    await expect(roomLinks(page)).toHaveCount(1);
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await search(page).fill('zzz');
    await expect(
      main(page).getByText('Tidak ada ruang yang cocok'),
    ).toBeVisible();
    await expect(main(page).getByText('Coba kata lain.')).toBeVisible();
    await strictGates(page, testInfo, 'inbox-no-match', lit(testInfo));
    // Reload keeps it; clearing shows every room again.
    await page.reload();
    await expect(search(page)).toHaveValue('zzz');
    await search(page).fill('');
    await expect(roomLinks(page)).toHaveCount(2);
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
  });

  test('Belum dibaca keeps rooms with unread messages, with the search too; with nothing unread, "Semua sudah dibaca."', async ({
    page,
    db,
  }) => {
    await openInbox(page);
    await expect(unreadChip(page)).toHaveAttribute('aria-pressed', 'false');
    await unreadChip(page).click();
    await expect(unreadChip(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/[?&]unread=true/);
    await expect(roomLinks(page)).toHaveCount(1);
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await search(page).fill('heron');
    await expect(
      main(page).getByText('Tidak ada ruang yang cocok'),
    ).toBeVisible();
    await search(page).fill('');
    await unreadChip(page).click();
    await expect(roomLinks(page)).toHaveCount(2);
    // Everything read.
    db.chatroomReads = ['m1', 'm3', 'm5'];
    await page.goto('/kelola/curhat?unread=true');
    await expect(main(page).getByText('Semua sudah dibaca.')).toBeVisible();
    await expect(roomLinks(page)).toHaveCount(0);
  });

  test('no rooms at all', async ({ page, db }, testInfo) => {
    db.chatrooms = {};
    await page.goto('/kelola/curhat');
    await expect(main(page).getByText('Belum ada ruang')).toBeVisible();
    await expect(
      main(page).getByText('Ruang baru dari anggota muncul di sini.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'inbox-empty', lit(testInfo));
  });
});

// ---------------------------------------------------------------- Pins

test.describe('pins', () => {
  test('pin and unpin: the PUT body, the toast, "Disematkan" first and "Ruang lain" after', async ({
    page,
    api,
    db,
  }, testInfo) => {
    canPin(api);
    await openInbox(page);
    await options(page, 'Amber Heron').click();
    const item = page.getByRole('menuitem', { name: 'Sematkan ruang' });
    await expect(item).toBeVisible();
    // The menu open: axe, sizes and overflow (Tab, for the focus gate, would close it).
    await strictAudit(page, testInfo, 'inbox-pin-menu');
    await item.click();
    await expect(toastText(page, 'Ruang disematkan.')).toBeVisible();
    expect(
      api
        .calls('PUT /api/curhat/chatroom/:chatroomId/pin')
        .map((c) => [c.path, c.body]),
    ).toEqual([['/api/curhat/chatroom/r2/pin', { isPinned: true }]]);
    expect(db.chatrooms.r2.isPinned).toBe(true);
    await expect(main(page).getByRole('heading', { level: 2 })).toHaveText([
      'Disematkan',
      'Ruang lain',
    ]);
    expect(await rowNames(page)).toEqual(['Amber Heron', 'Teal Koala']);
    await strictGates(page, testInfo, 'inbox-pinned', lit(testInfo));
    // After a reload, the server's pin.
    await page.reload();
    await expect(main(page).getByRole('heading', { level: 2 })).toHaveText([
      'Disematkan',
      'Ruang lain',
    ]);

    await options(page, 'Amber Heron').click();
    await page.getByRole('menuitem', { name: 'Lepas sematan' }).click();
    await expect(toastText(page, 'Sematan dilepas.')).toBeVisible();
    expect(
      api.calls('PUT /api/curhat/chatroom/:chatroomId/pin').at(-1)!.body,
    ).toEqual({ isPinned: false });
    await expect(main(page).getByRole('heading', { level: 2 })).toHaveCount(0);
    expect(await rowNames(page)).toEqual(['Teal Koala', 'Amber Heron']);
  });

  test('busy while it runs: no second request', async ({ page, api }) => {
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    api.on('PUT /api/curhat/chatroom/:chatroomId/pin', async (req) => {
      await held;
      return writes.pinRoom(req);
    });
    await openInbox(page);
    await options(page, 'Amber Heron').click();
    await page.getByRole('menuitem', { name: 'Sematkan ruang' }).click();
    await expect(options(page, 'Amber Heron')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await options(page, 'Amber Heron').click();
    const busy = page.getByRole('menuitem', { name: 'Sematkan ruang' });
    await expect(busy).toHaveAttribute('aria-disabled', 'true');
    // Playwright waits for an aria-disabled item to be enabled; press it as a member can, right away.
    await busy.click({ force: true });
    await page.keyboard.press('Escape');
    release();
    await expect(toastText(page, 'Ruang disematkan.')).toBeVisible();
    expect(api.calls('PUT /api/curhat/chatroom/:chatroomId/pin')).toHaveLength(
      1,
    );
  });

  test('a 401 while the role is still there: "no access", not signed out; another failure the general line', async ({
    page,
    api,
  }) => {
    api.on(
      'PUT /api/curhat/chatroom/:chatroomId/pin',
      reply.status(401, { error: 'Unauthorized' }),
    );
    await openInbox(page);
    const checks = api.calls('GET /api/me').length;
    await options(page, 'Amber Heron').click();
    await page.getByRole('menuitem', { name: 'Sematkan ruang' }).click();
    await expect(
      toastText(page, 'Kamu tidak punya akses untuk menyematkan ruang ini.'),
    ).toBeVisible();
    // The session is checked again; the role is still there, so the inbox stays.
    await expect
      .poll(() => api.calls('GET /api/me').length)
      .toBeGreaterThan(checks);
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
    await expect(main(page).getByRole('heading', { level: 2 })).toHaveCount(0);

    api.on('PUT /api/curhat/chatroom/:chatroomId/pin', reply.status(500));
    await options(page, 'Teal Koala').click();
    await page.getByRole('menuitem', { name: 'Sematkan ruang' }).click();
    await expect(
      toastText(page, 'Sematan gagal disimpan. Coba lagi.'),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('the room’s header has the same item', async ({
    page,
    api,
  }, testInfo) => {
    canPin(api);
    await openR1(page, api);
    await roomOptions(page, testInfo).click();
    await page.getByRole('menuitem', { name: 'Sematkan ruang' }).click();
    await expect(toastText(page, 'Ruang disematkan.')).toBeVisible();
    expect(
      api.calls('PUT /api/curhat/chatroom/:chatroomId/pin').map((c) => c.path),
    ).toEqual(['/api/curhat/chatroom/r1/pin']);
    await roomOptions(page, testInfo).click();
    await expect(
      page.getByRole('menuitem', { name: 'Lepas sematan' }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------- A room

test.describe('a room', () => {
  test('opening Teal Koala reads it; the sides and time lines; no delete; back on the list its count is gone', async ({
    page,
    api,
  }, testInfo) => {
    canRead(api);
    await openInbox(page);
    await row(page, 'Teal Koala').click();
    await expect(page).toHaveURL(/\/kelola\/curhat\/r1$/);
    await expect(log(page)).toBeVisible();
    await expect(page).toHaveTitle('Teal Koala · PIPS!');
    await expect
      .poll(() =>
        api
          .calls('POST /api/curhat/chatroom/:chatroomId/read')
          .map((c) => c.path),
      )
      .toEqual(['/api/curhat/chatroom/r1/read']);
    // The member's messages on the left under the room's name; Welfare's (Raka's) in gold on the right.
    await expect(bubble(page, M1)).toHaveClass(/\bthem\b/);
    await expect(bubble(page, M1)).toContainText('Teal Koala · 21.10');
    await expect(bubble(page, M1)).toHaveText(
      `Teal Koala: ${M1}Teal Koala · 21.10`,
    );
    await expect(bubble(page, `Teal Koala: ${M3}`)).toHaveClass(/\bthem\b/);
    await expect(bubble(page, M4)).toHaveClass(/\bme\b/);
    await expect(bubble(page, M4)).toHaveText(
      `Membalas: ${M3}Kamu: ${M4}10.12`,
    );
    // No delivery states, no delete.
    await expect(log(page).getByText(/Terkirim|Mengirim|Gagal/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Hapus ruang/ })).toHaveCount(
      0,
    );
    await expect(composer(page)).toHaveAttribute(
      'placeholder',
      'Tulis balasan…',
    );
    if (isDesk(testInfo)) {
      const crumbs = page.getByRole('navigation', { name: 'Jejak halaman' });
      await expect(crumbs).toHaveText(/Kelola\s*Curhat Yuk!\s*Teal Koala/);
    } else {
      // A focused flow: no tab bar or rail.
      await expect(
        page.getByRole('navigation', { name: 'Navigasi utama' }),
      ).toBeHidden();
    }
    await strictGates(page, testInfo, 'inbox-room', roomLit(testInfo));
    await page.goBack();
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await expect(row(page, 'Teal Koala').locator('.g-count')).toHaveCount(0);
    await expect(row(page, 'Teal Koala')).not.toHaveAccessibleName(
      /pesan baru/,
    );
  });

  test('a teammate’s message reads "Welfare · " on Welfare’s side', async ({
    page,
    api,
    db,
  }) => {
    db.chatrooms.r1.messages = [
      {
        ...fromMember('m-mate', 'r1', 'Aku bantu cek jadwalnya juga ya.'),
        fromOwner: false,
      },
      ...db.chatrooms.r1.messages!,
    ];
    await openR1(page, api);
    const mate = bubble(page, 'Aku bantu cek jadwalnya juga ya.');
    await expect(mate).toHaveClass(/\bme\b/);
    await expect(mate).toHaveText(
      'Welfare: Aku bantu cek jadwalnya juga ya.Welfare · 13.35',
    );
  });

  test('Balas on m3, then send: the exact payload, busy until the acknowledgement, then the bubble', async ({
    page,
    api,
    db,
  }) => {
    await openR1(page, api);
    api.socket.answer('message', () => undefined);
    await log(page).getByRole('button', { name: 'Balas' }).nth(2).click();
    await expect(page.locator('.g-reply-chip')).toContainText(
      `Membalas: ${M3}`,
    );
    await expect(composer(page)).toBeFocused();
    await composer(page).fill(REPLY);
    await sendButton(page).click();
    await expect
      .poll(() => api.socket.emitted('message').map((e) => e.data))
      .toEqual([
        {
          chatroomId: 'r1',
          message: REPLY,
          replyId: 'm3',
          clientMessageId: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
        },
      ]);
    // Nothing drawn until the server says so; the button is busy; the text stays.
    await expect(sendButton(page)).toHaveAttribute('aria-busy', 'true');
    await expect(bubble(page, REPLY)).toHaveCount(0);
    await expect(composer(page)).toHaveValue(REPLY);
    // A second press sends nothing (forced: Playwright would wait for the busy button to be enabled again).
    await sendButton(page).click({ force: true });
    expect(api.socket.emitted('message')).toHaveLength(1);

    const [entry] = api.socket.emitted('message');
    const data = entry.data as { clientMessageId: string };
    const saved: ChatroomMessage = {
      id: 'e2e-reply',
      chatroomId: 'r1',
      replyId: 'm3',
      content: REPLY,
      createdAt: NOW,
      isSender: true,
      fromOwner: false,
      clientMessageId: data.clientMessageId,
      reply: {
        id: 'm3',
        chatroomId: 'r1',
        replyId: null,
        content: M3,
        createdAt: db.chatrooms.r1.messages!.find((m) => m.id === 'm3')!
          .createdAt,
      },
    };
    db.chatrooms.r1.messages = [saved, ...db.chatrooms.r1.messages!];
    expect(api.socket.ack(entry, { ok: true, message: saved })).toBe(true);
    await expect(bubble(page, REPLY)).toHaveText(
      `Membalas: ${M3}Kamu: ${REPLY}13.35`,
    );
    await expect(bubble(page, REPLY)).toHaveClass(/\bme\b/);
    await expect(composer(page)).toHaveValue('');
    await expect(page.locator('.g-reply-chip')).toHaveCount(0);
    await expect(sendButton(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(composer(page)).toBeFocused();
  });

  test('an error acknowledgement: the toast, the text kept, nothing drawn', async ({
    page,
    api,
  }) => {
    await openR1(page, api);
    api.socket.answer('message', () => ({ ok: false, error: 'server' }));
    await composer(page).fill(REPLY);
    await sendButton(page).click();
    await expect(toastText(page, FAILED)).toBeVisible();
    await expect(composer(page)).toHaveValue(REPLY);
    await expect(bubble(page, REPLY)).toHaveCount(0);
    await expect(log(page).getByText(/Gagal|Kirim ulang/)).toHaveCount(0);
  });

  test('no acknowledgement in 10 s: the toast, the text kept', async ({
    page,
    api,
  }) => {
    await openR1(page, api);
    api.socket.answer('message', () => undefined);
    await composer(page).fill(REPLY);
    await sendButton(page).click();
    await page.clock.fastForward(9_000);
    await expect(toastText(page, FAILED)).toHaveCount(0);
    await page.clock.fastForward(1_500);
    await expect(toastText(page, FAILED)).toBeVisible();
    await expect(composer(page)).toHaveValue(REPLY);
    await expect(bubble(page, REPLY)).toHaveCount(0);
  });

  test('regression (A11): saved, its acknowledgement lost, sent again: two emits with one id, saved once, one bubble', async ({
    page,
    api,
    db,
  }) => {
    await openR1(page, api);
    api.socket.saveWithoutAnswer();
    await composer(page).fill(REPLY);
    await sendButton(page).click();
    await page.clock.fastForward(10_500);
    await expect(toastText(page, FAILED)).toBeVisible();
    expect(
      db.chatrooms.r1.messages!.filter((m) => m.content === REPLY),
    ).toHaveLength(1);
    await expect(bubble(page, REPLY)).toHaveCount(0);

    api.socket.answerAsApi('message');
    await sendButton(page).click();
    await expect(bubble(page, REPLY)).toHaveCount(1);
    await expect(composer(page)).toHaveValue('');
    const sent = api.socket.emitted('message').map((e) => e.data);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(
      db.chatrooms.r1.messages!.filter((m) => m.content === REPLY),
    ).toHaveLength(1);
    await page.reload();
    await expect(bubble(page, REPLY)).toHaveCount(1);
  });

  // Review M1 (round 2): the drop-then-reconnect case, the most common way to lose an acknowledgement. The catch-up
  // fetch brings the server's copy, which settles the failed entry; sending "again" must not save a second copy.
  test('regression (M1): saved, its acknowledgement lost, then a drop and a reconnect: one bubble, the composer cleared, nothing sent again', async ({
    page,
    api,
    db,
  }) => {
    await openR1(page, api);
    api.socket.saveWithoutAnswer();
    await log(page).getByRole('button', { name: 'Balas' }).nth(2).click();
    await composer(page).fill(REPLY);
    await sendButton(page).click();
    await page.clock.fastForward(10_500);
    await expect(toastText(page, FAILED)).toBeVisible();
    await expect(composer(page)).toHaveValue(REPLY);
    await expect(bubble(page, REPLY)).toHaveCount(0);

    api.socket.drop();
    api.socket.restore();
    await page.clock.fastForward(6_000);
    await socketReady(api);
    // The catch-up fetch brought the server's copy: shown once, and the reply is done.
    await expect(bubble(page, REPLY)).toHaveCount(1);
    await expect(composer(page)).toHaveValue('');
    await expect(page.locator('.g-reply-chip')).toHaveCount(0);
    expect(
      db.chatrooms.r1.messages!.filter((m) => m.content === REPLY),
    ).toHaveLength(1);

    // Pressing send now sends nothing: no second copy.
    api.socket.answerAsApi('message');
    await sendButton(page).click();
    await page.clock.fastForward(1_000);
    expect(api.socket.emitted('message')).toHaveLength(1);
    expect(
      db.chatrooms.r1.messages!.filter((m) => m.content === REPLY),
    ).toHaveLength(1);
    await expect(bubble(page, REPLY)).toHaveCount(1);
  });

  test('changed text after a failure is a new message with a new id', async ({
    page,
    api,
  }) => {
    await openR1(page, api);
    api.socket.answer('message', () => ({ ok: false, error: 'server' }));
    await composer(page).fill(REPLY);
    await sendButton(page).click();
    await expect(toastText(page, FAILED)).toBeVisible();
    api.socket.answerAsApi('message');
    await composer(page).fill(`${REPLY} Sebentar.`);
    await sendButton(page).click();
    await expect(bubble(page, `${REPLY} Sebentar.`)).toBeVisible();
    const [a, b] = api.socket
      .emitted('message')
      .map((e) => (e.data as { clientMessageId: string }).clientMessageId);
    expect(a).not.toEqual(b);
  });

  test('the member’s message arrives in the open room, on their side, and is read at once', async ({
    page,
    api,
  }) => {
    await openR1(page, api);
    await expect
      .poll(() => api.calls('POST /api/curhat/chatroom/:chatroomId/read'))
      .toHaveLength(1);
    const text = 'Boleh kak, makasih banyak.';
    expect(
      api.socket.emit('reply', fromMember('m-live', 'r1', text), (s) =>
        s.rooms.has('r1'),
      ),
    ).toBe(1);
    await expect(bubble(page, text)).toHaveClass(/\bthem\b/);
    await expect(bubble(page, text)).toContainText('Teal Koala · 13.35');
    await expect(bubble(page, text)).toBeInViewport();
    await expect
      .poll(() => api.calls('POST /api/curhat/chatroom/:chatroomId/read'))
      .toHaveLength(2);
  });

  test('a room that’s gone: "Ruang tidak ditemukan", back to the inbox', async ({
    page,
  }, testInfo) => {
    await page.goto('/kelola/curhat/tidak-ada');
    await expect(
      main(page).getByText('Ruang ini sudah dihapus.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'inbox-not-found', roomLit(testInfo));
    await main(page)
      .getByRole('button', { name: 'Kembali ke Curhat Yuk!' })
      .click();
    await expect(page).toHaveURL(/\/kelola\/curhat$/);
  });

  test('refused as forbidden (the member deleted it): the rooms are fetched again and it is not found; no toast', async ({
    page,
    api,
    db,
  }) => {
    await openR1(page, api);
    delete db.chatrooms.r1;
    api.socket.answer('message', () => ({ ok: false, error: 'forbidden' }));
    await composer(page).fill(REPLY);
    await sendButton(page).click();
    await expect(
      main(page).getByText('Ruang ini sudah dihapus.'),
    ).toBeVisible();
    await expect(toastText(page, FAILED)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------- Live

test.describe('live', () => {
  test('a member’s message reaches the list: the room moves up with its preview and count', async ({
    page,
    api,
  }) => {
    await openInbox(page);
    await socketReady(api);
    const text = 'Kak, aku mau cerita lagi.';
    api.socket.emit('reply', fromMember('m-r2', 'r2', text), (s) =>
      s.rooms.has('r2'),
    );
    await expect(roomLinks(page).first()).toContainText('Amber Heron');
    await expect
      .poll(() => rowNames(page))
      .toEqual(['Amber Heron', 'Teal Koala']);
    await expect(row(page, 'Amber Heron')).toHaveAccessibleName(
      `Amber Heron , 1 pesan baru Anggota: ${text} 13.35`,
    );
  });

  test('a message in a room the inbox doesn’t know yet fetches the rooms again', async ({
    page,
    api,
    db,
  }) => {
    await openInbox(page);
    await socketReady(api);
    const fetched = api.calls('GET /api/curhat/chatrooms').length;
    const text = 'Halo, aku baru mulai ruang ini.';
    db.chatrooms.r7 = {
      id: 'r7',
      title: 'violet panda',
      canDelete: false,
      isPinned: false,
      messages: [fromMember('m-r7', 'r7', text)],
    };
    // A room started after Welfare connected: the API joins Welfare's sockets through the group room.
    for (const s of api.socket.sessions.values())
      if (s.rooms.has('curhat:welfare')) s.rooms.add('r7');
    api.socket.emit('reply', fromMember('m-r7', 'r7', text), (s) =>
      s.rooms.has('r7'),
    );
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms').length)
      .toBeGreaterThan(fetched);
    await expect(row(page, 'Violet Panda')).toContainText(`Anggota: ${text}`);
  });

  test('the connection drops: the banner; back: the rooms and counts are fetched again', async ({
    page,
    api,
  }) => {
    await openInbox(page);
    await socketReady(api);
    const rooms = api.calls('GET /api/curhat/chatrooms').length;
    const counts = api.calls('GET /api/curhat/chatrooms/unread').length;
    api.socket.drop();
    await expect(
      main(page).getByText('Koneksi Curhat terputus. Menyambungkan lagi…'),
    ).toBeVisible();
    api.socket.restore();
    await socketReady(api);
    await expect(
      main(page).getByText('Koneksi Curhat terputus. Menyambungkan lagi…'),
    ).toHaveCount(0);
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms').length)
      .toBeGreaterThan(rooms);
    await expect
      .poll(() => api.calls('GET /api/curhat/chatrooms/unread').length)
      .toBeGreaterThan(counts);
  });

  test('leaving the inbox closes its connection', async ({ page, api }) => {
    await page.goto('/layanan');
    await main(page).locator('a[href="/kelola/curhat"]').click();
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await socketReady(api);
    // Out of the area in the app (a reload would end the page, not the area).
    await page.goBack();
    await expect(page).toHaveURL(/\/layanan$/);
    await expect
      .poll(() =>
        [...api.socket.sessions.values()].some(
          (s) => s.connected && s.auth.curhat === true,
        ),
      )
      .toBe(false);
  });
});

// ---------------------------------------------------------------- States

test.describe('states', () => {
  test('loading: list-row skeletons after 300 ms', async ({ page, api }) => {
    api.on('GET /api/curhat/chatrooms', reply.hang());
    await page.goto('/kelola/curhat');
    await expect(
      page.getByRole('status', { name: 'Memuat ruang…' }),
    ).toBeVisible();
  });

  test('503, then Coba lagi', async ({ page, api }, testInfo) => {
    api.on('GET /api/curhat/chatrooms', reply.status(503));
    await page.goto('/kelola/curhat');
    const failed = main(page)
      .getByRole('alert')
      .filter({ hasText: 'Ruang cerita gagal dimuat.' });
    await expect(failed).toBeVisible();
    await strictGates(page, testInfo, 'inbox-error', lit(testInfo));
    api.on('GET /api/curhat/chatrooms', ({ db }) => db.chatrooms);
    await failed.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(row(page, 'Teal Koala')).toBeVisible();
  });

  test('offline: the banner with the last update over the rooms already loaded', async ({
    page,
    api,
  }) => {
    await openInbox(page);
    await api.setOffline(true);
    await expect(main(page).locator('.g-offline')).toContainText('13.35');
    await expect(roomLinks(page)).toHaveCount(2);
    await api.setOffline(false);
  });
});

// ---------------------------------------------------------------- Privacy

test('no member name, NIM or email anywhere in the page or in what it sends', async ({
  page,
  api,
}) => {
  canPin(api);
  canRead(api);
  await openInbox(page);
  await options(page, 'Amber Heron').click();
  await page.getByRole('menuitem', { name: 'Sematkan ruang' }).click();
  await expect(toastText(page, 'Ruang disematkan.')).toBeVisible();
  const listText = await main(page).innerText();
  await row(page, 'Teal Koala').click();
  await expect(log(page)).toBeVisible();
  await socketReady(api);
  await composer(page).fill(REPLY);
  await sendButton(page).click();
  await expect(bubble(page, REPLY)).toBeVisible();
  const roomText = await page.locator('body').innerText();
  for (const text of [listText, roomText])
    for (const secret of [NADIA.name, 'Nadia', NADIA.nim, NADIA_EMAIL])
      expect(text).not.toContain(secret);
  const sent = JSON.stringify([
    api.writes.map((w) => [w.path, w.query, w.body]),
    api.socket.emitted().map((e) => e.data),
  ]);
  for (const secret of [NADIA.name, NADIA.nim, NADIA_EMAIL, 'userId'])
    expect(sent).not.toContain(secret);
});

// ---------------------------------------------------------------- Gates

test.describe('gates at every size', () => {
  const LONG =
    'Aku pengen cerita panjang soal minggu ini karena rasanya semua tenggat datang bersamaan dan aku belum tahu harus mulai dari mana, apalagi ada rapat kepanitiaan tiap Rabu malam yang selalu molor sampai larut.';

  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`a long room list and a room with long messages and the reply chip at ${width} px @desktop-only`, async ({
      page,
      api,
      db,
    }, testInfo) => {
      canRead(api);
      for (let i = 0; i < 12; i++)
        db.chatrooms[`x${i}`] = {
          id: `x${i}`,
          title: 'chartreuse hippopotamus',
          canDelete: false,
          isPinned: i < 2,
          messages: [fromMember(`x${i}-m`, `x${i}`, LONG)],
        };
      db.chatrooms.r1.messages = [
        { ...fromMember('m-long', 'r1', LONG), replyId: 'm4' },
        ...db.chatrooms.r1.messages!,
      ];
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/kelola/curhat');
      await expect(row(page, 'Teal Koala')).toBeVisible();
      await strictGates(
        page,
        testInfo,
        `inbox-list-${width}`,
        width < 1024 ? 'Layanan' : 'Kelola',
      );
      await row(page, 'Teal Koala').click();
      await expect(log(page)).toBeVisible();
      await composer(page).fill(LONG);
      await log(page).getByRole('button', { name: 'Balas' }).last().click();
      await expect(
        page.getByRole('button', { name: 'Batal membalas' }),
      ).toBeVisible();
      // strictGates clears the sticky top bar's edge first (e2e/support/strict.ts, `clearTopBarEdge`).
      await strictGates(
        page,
        testInfo,
        `inbox-room-${width}`,
        width < 1024 ? null : 'Kelola',
      );
    });
  }

  test('at 200 % zoom @desktop-only', async ({ page, api }, testInfo) => {
    canRead(api);
    await page.setViewportSize({ width: 720, height: 450 });
    await openInbox(page);
    await strictGates(page, testInfo, 'inbox-list-zoom', null);
    await row(page, 'Teal Koala').click();
    await expect(log(page)).toBeVisible();
    await strictGates(page, testInfo, 'inbox-room-zoom', null);
  });

  test('touch: the search and the composer at 16 px, the composer’s targets 44 px @phone-only', async ({
    page,
    api,
  }) => {
    await openInbox(page);
    expect(
      await search(page).evaluate((el) => getComputedStyle(el).fontSize),
    ).toBe('16px');
    await openR1(page, api);
    expect(
      await composer(page).evaluate((el) => getComputedStyle(el).fontSize),
    ).toBe('16px');
    for (const target of [composer(page), sendButton(page)])
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test('nothing moves after first paint under reduced motion', async ({
    page,
    api,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openR1(page, api);
    const moving = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === 'running')
          .length,
    );
    expect(moving).toBe(0);
  });
});
