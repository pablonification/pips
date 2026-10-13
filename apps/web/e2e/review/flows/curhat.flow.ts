/** Curhat Yuk! (P2-C; Welfare's inbox P3-C): curhat-start, curhat-room, curhat-delete, curhat-inbox. */
import type { Page } from '@playwright/test';
import type { CurhatSocketMessage } from '../../../src/api/generated';
import { NOW } from '../../fixtures/api';
import { toastText } from '../../support/pengumuman';
import * as writes from '../../support/writes';
import { PACE, expect, flow } from '../support';

const M4 = 'Oke, coba kita susun bareng ya. Mau aku bantu bikin jadwal mingguan sampai UTS?';
const MINE = 'Boleh minta jadwalnya kak?';
const main = (page: Page) => page.getByRole('main');
const roomLinks = (page: Page, base = '/layanan/curhat/') => main(page).locator(`a[href^="${base}"]`);
const row = (page: Page, name: string, base?: string) => roomLinks(page, base).filter({ hasText: name });
const log = (page: Page, name = 'Teal Koala') => page.getByRole('log', { name: `Percakapan ${name}` });
const composer = (page: Page) => page.getByRole('textbox', { name: 'Tulis pesan untuk tim Welfare' });
const sendButton = (page: Page) => page.getByRole('button', { name: 'Kirim pesan' });
const bubble = (page: Page, text: string, room = 'Teal Koala') =>
  log(page, room).locator('.g-bubble').filter({ hasText: text });
const newRoom = (page: Page) => main(page).getByRole('button', { name: 'Mulai ruang baru' });
const connected = (api: { socket: { sessions: Map<unknown, { connected: boolean }> } }) =>
  [...api.socket.sessions.values()].filter((s) => s.connected).length;

/** What the API acknowledges a message with. */
function saved(data: unknown, id: string): CurhatSocketMessage {
  const d = data as { chatroomId: string; message: string; replyId?: string; clientMessageId?: string };
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

flow('curhat-start', 'nadia', {}, async ({ page, f, api }) => {
  api.on('POST /api/curhat/chatroom', writes.createRoom);
  await f.step('Before the first message: who reads it and what stays anonymous', async () => {
    await f.open('/layanan/curhat');
    await expect(main(page).getByText('Anonim. Namamu tidak ditampilkan ke tim Welfare.')).toBeVisible();
    await f.gate('curhat-list');
    await f.hold();
  });
  await f.step('Rooms with their unread counts; 2 of 3 rooms used', async () => {
    await expect(row(page, 'Teal Koala')).toHaveAccessibleName(`Teal Koala , 1 pesan baru Welfare: ${M4} 10.12`);
    await expect(main(page).getByText('2 dari 3 ruang dipakai')).toBeVisible();
    await expect.poll(() => connected(api)).toBe(1);
  });
  await f.step('A new room, with its random name', async () => {
    await newRoom(page).click();
    await expect(page).toHaveURL(/\/layanan\/curhat\/e2e-room-3$/);
    await expect(toastText(page, 'Ruang “Lime Otter” dibuat. Namamu tetap tersembunyi.')).toBeVisible();
    await expect(main(page).getByText('Tulis pesan pertamamu. Tim Welfare membalas di sini.')).toBeVisible();
    await f.gate('curhat-new-room');
    await f.hold();
  });
  await f.step('At 3 rooms: no more, and it says why', async () => {
    await page.goBack();
    await expect(main(page).getByText('3 dari 3 ruang dipakai')).toBeVisible();
    await expect(main(page).getByText('Hapus salah satu ruang untuk membuat yang baru.')).toBeVisible();
    await expect(newRoom(page)).toHaveAttribute('aria-disabled', 'true');
    await newRoom(page).focus();
    await page.keyboard.press('Enter');
    await expect(toastText(page, 'Maksimal 3 ruang. Hapus salah satu ruang dulu.')).toBeVisible();
    expect(api.calls('POST /api/curhat/chatroom')).toHaveLength(1);
    await f.gate('curhat-full');
    await f.hold();
  });
});

flow('curhat-start', 'raka', {}, async ({ page, f }) => {
  await f.step('Raka has no rooms yet', async () => {
    await f.open('/layanan/curhat');
    await expect(main(page).getByText('Belum ada ruang cerita')).toBeVisible();
    await expect(main(page).getByText('0 dari 3 ruang dipakai')).toBeVisible();
    await expect(newRoom(page)).toBeVisible();
    await f.gate('curhat-empty');
    await f.hold();
  });
});

flow('curhat-room', 'nadia', {}, async ({ page, f, api, db, layout }) => {
  const desk = layout === 'desktop';
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
  await f.step('Teal Koala opens; its unread clears', async () => {
    await f.open('/layanan/curhat');
    await row(page, 'Teal Koala').click();
    await expect(log(page)).toBeVisible();
    await expect.poll(() => api.calls('POST /api/curhat/chatroom/:chatroomId/read').map((c) => c.path)).toEqual([
      '/api/curhat/chatroom/r1/read',
    ]);
    if (!desk) await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toHaveCount(0);
    await f.gate('curhat-room');
  });
  await f.step('Balas on Welfare’s message', async () => {
    await log(page).getByRole('button', { name: 'Balas' }).last().click();
    await expect(page.locator('.g-reply-chip')).toHaveText(`Membalas: ${M4}`);
    await expect(composer(page)).toBeFocused();
    await f.gate('curhat-reply-chip');
  });
  await f.step(desk ? 'Shift+Enter adds a line (Enter sends on a keyboard)' : 'Enter adds a line on a touch keyboard', async () => {
    await composer(page).click();
    await page.keyboard.type('Mau kak,', { delay: PACE.key });
    await page.keyboard.press(desk ? 'Shift+Enter' : 'Enter');
    await page.keyboard.type('makasih!', { delay: PACE.key });
    await expect(composer(page)).toHaveValue('Mau kak,\nmakasih!');
    expect(api.socket.emitted('message')).toEqual([]);
  });
  await f.step('Kirim: Mengirim, then Terkirim', async () => {
    api.socket.answer('message', () => undefined);
    await sendButton(page).click();
    await expect(bubble(page, 'makasih!')).toContainText('Mengirim');
    await f.hold();
    const [sent] = api.socket.emitted('message');
    api.socket.ack(sent, { ok: true, message: saved(sent.data, 'm10') });
    await expect(bubble(page, 'makasih!')).toContainText('Terkirim · 13.35');
    api.socket.answerAsApi('message');
    await f.hold();
  });
  await f.step('A lost acknowledgement: Gagal; Kirim ulang shows the message once (A11)', async () => {
    api.socket.saveWithoutAnswer();
    await composer(page).fill(MINE);
    await sendButton(page).click();
    await expect(bubble(page, MINE)).toContainText('Mengirim');
    await page.clock.fastForward(10_500);
    // Gagal and Kirim ulang sit under the bubble, in the room's log.
    await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
    await f.hold();
    api.socket.answerAsApi('message');
    await log(page).getByRole('button', { name: 'Kirim ulang' }).click();
    // Delivered: no Gagal, no Kirim ulang, one bubble. ("Terkirim" marks only the newest delivered message, and the
    // fake server saves every message at the fixed clock's minute, so it may sit under an earlier one.)
    await expect(log(page).getByText('Gagal', { exact: true })).toHaveCount(0);
    await expect(log(page).getByRole('button', { name: 'Kirim ulang' })).toHaveCount(0);
    await expect(bubble(page, MINE)).toHaveCount(1);
    expect(db.chatrooms.r1.messages!.filter((m) => m.content === MINE)).toHaveLength(1);
    await f.hold();
  });
  await f.step('The connection drops: the banner, and a message fails', async () => {
    api.socket.drop();
    await expect(page.getByText('Koneksi Curhat terputus. Menyambungkan lagi…')).toBeVisible();
    await f.gate('curhat-dropped');
    await composer(page).fill('Satu lagi kak.');
    await sendButton(page).click();
    await expect(log(page).getByText('Gagal', { exact: true })).toBeVisible();
    await f.hold();
  });
  await f.step('Back: the banner goes; Kirim ulang delivers it', async () => {
    api.socket.restore();
    await page.clock.fastForward(6_000);
    await expect(page.getByText('Koneksi Curhat terputus. Menyambungkan lagi…')).toHaveCount(0, { timeout: 15_000 });
    await log(page).getByRole('button', { name: 'Kirim ulang' }).click();
    await expect(log(page).getByText('Gagal', { exact: true })).toHaveCount(0);
    await expect(log(page).getByRole('button', { name: 'Kirim ulang' })).toHaveCount(0);
    await expect(bubble(page, 'Satu lagi kak.')).not.toContainText('Mengirim');
    await f.hold();
  });
  await f.step('Back to the list and in again: still connected', async () => {
    const before = api.socket.sessions.size;
    if (desk) await page.goBack();
    else await page.getByRole('button', { name: 'Kembali ke Curhat Yuk!' }).click();
    await expect(row(page, 'Teal Koala')).toBeVisible();
    await row(page, 'Teal Koala').click();
    await expect(bubble(page, MINE)).toHaveCount(1);
    expect(api.socket.sessions.size).toBe(before);
    expect(connected(api)).toBe(1);
    await f.hold();
  });
});

flow('curhat-delete', 'nadia', {}, async ({ page, f, api, layout }) => {
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
  api.on('DELETE /api/curhat/chatroom/:chatroomId', writes.deleteRoom);
  await f.step('Teal Koala, Hapus ruang', async () => {
    await f.open('/layanan/curhat');
    await row(page, 'Teal Koala').click();
    await expect(log(page)).toBeVisible();
    if (layout === 'desktop') await main(page).getByRole('button', { name: 'Hapus ruang' }).click();
    else await page.getByRole('button', { name: 'Hapus ruang ini' }).click();
  });
  await f.step('The confirmation names what goes', async () => {
    const dialog = page.getByRole('alertdialog', { name: 'Hapus ruang ini?' });
    await expect(dialog).toContainText('Seluruh percakapan di ruang ini hilang, juga untuk tim Welfare.');
    await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused();
    await f.gate('curhat-delete-confirm');
    await f.hold();
    await dialog.getByRole('button', { name: 'Hapus ruang' }).click();
  });
  await f.step('It is gone', async () => {
    await expect(page).toHaveURL(/\/layanan\/curhat$/);
    await expect(toastText(page, 'Ruang dihapus.')).toBeVisible();
    await expect(row(page, 'Teal Koala')).toHaveCount(0);
    await expect(main(page).getByText('1 dari 3 ruang dipakai')).toBeVisible();
    await f.hold();
  });
});

flow('curhat-inbox', 'welfare', { roles: ['curhatadmin'] }, async ({ page, f, api, db }) => {
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
  api.on('PUT /api/curhat/chatroom/:chatroomId/pin', writes.pinRoom);
  const inboxRow = (name: string) => row(page, name, '/kelola/curhat/');
  const search = main(page).getByRole('searchbox', { name: 'Cari ruang curhat' });
  // A teammate's message in Teal Koala, so the room shows both sides of Welfare.
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
    ...db.chatrooms.r1.messages!,
  ];
  await f.step('Welfare’s inbox: every room, with unread counts', async () => {
    await f.open('/kelola/curhat');
    await expect(inboxRow('Teal Koala')).toBeVisible();
    await expect(inboxRow('Amber Heron')).toBeVisible();
    await expect(inboxRow('Teal Koala').locator('.g-count')).toBeVisible();
    await f.gate('inbox-list');
    await f.hold();
  });
  await f.step('Search by a word from a message', async () => {
    await f.type(search, 'kepanitiaan');
    await expect(roomLinks(page, '/kelola/curhat/')).toHaveCount(1);
    await expect(inboxRow('Teal Koala')).toBeVisible();
    await f.hold();
    await search.fill('');
    await expect(roomLinks(page, '/kelola/curhat/')).toHaveCount(2);
  });
  await f.step('Belum dibaca', async () => {
    const chip = main(page).getByRole('button', { name: 'Belum dibaca' });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(roomLinks(page, '/kelola/curhat/')).toHaveCount(1);
    await f.hold();
    await chip.click();
    await expect(roomLinks(page, '/kelola/curhat/')).toHaveCount(2);
  });
  await f.step('Pin Amber Heron: "Disematkan" first', async () => {
    await main(page).getByRole('button', { name: 'Opsi untuk Amber Heron' }).click();
    await page.getByRole('menuitem', { name: 'Sematkan ruang' }).click();
    await expect(toastText(page, 'Ruang disematkan.')).toBeVisible();
    await expect(main(page).getByRole('heading', { level: 2 })).toHaveText(['Disematkan', 'Ruang lain']);
    await f.gate('inbox-pinned');
    await f.hold();
  });
  await f.step('Teal Koala: the member’s messages and a teammate’s, told apart', async () => {
    await inboxRow('Teal Koala').click();
    await expect(log(page)).toBeVisible();
    await expect(bubble(page, 'Kak, aku lagi kewalahan')).toHaveClass(/\bthem\b/);
    await expect(bubble(page, 'Aku bantu cek jadwalnya juga ya.')).toContainText('Welfare · 13.35');
    await f.gate('inbox-room');
    await f.hold();
  });
  await f.step('A reply', async () => {
    const reply = page.getByRole('textbox', { name: 'Tulis balasan untuk Teal Koala' });
    await f.type(reply, 'Siap, aku kirim jadwalnya ya.');
    await sendButton(page).click();
    await expect(bubble(page, 'Siap, aku kirim jadwalnya ya.')).toHaveClass(/\bme\b/);
    await expect(reply).toHaveValue('');
    await f.hold();
  });
});
