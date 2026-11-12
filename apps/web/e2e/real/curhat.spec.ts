/**
 * Curhat Yuk! over the real socket, with two browsers: Nadia writes in her room, Welfare sees it in the inbox and
 * answers, and Nadia sees the answer live. After a reload the conversation is still there and nothing is unread.
 */
import { REAL_API_URL } from './ports.mjs';
import { expect, signIn, test, watch } from './support';

const ROOM = '/layanan/curhat/seed-curhat-1';
const INBOX_ROOM = '/kelola/curhat/seed-curhat-1';

test('a message reaches Welfare and the answer reaches the member, live', async ({
  page,
  problems,
  browser,
}) => {
  const welfareContext = await browser.newContext();
  await signIn(welfareContext, 'welfare');
  const welfare = await welfareContext.newPage();
  const welfareProblems = watch(welfare);

  const stamp = Date.now();
  const question = `Kak, boleh minta saran cara bagi waktu? (${stamp})`;
  const answer = `Boleh banget, coba mulai dari yang paling dekat tenggatnya. (${stamp})`;

  await page.goto(ROOM);
  const memberLog = page.getByRole('log', { name: /^Percakapan / });
  await expect(
    memberLog.getByText('Coba tulis dulu semua tugasnya', { exact: false }),
  ).toBeVisible();

  // Welfare's socket is up before Nadia sends, so her message reaches the open room over the socket, live; one sent
  // earlier would arrive with the rooms read that follows the connection instead. "40" is socket.io's answer to a
  // connection; one response can carry several packets, with this character between them.
  const PACKET_END = '\u001e';
  const welfareConnected = welfare.waitForResponse(
    async (r) =>
      r.url().includes('/socket.io/') &&
      r.request().method() === 'GET' &&
      (await r.text().catch(() => ''))
        .split(PACKET_END)
        .some((packet) => packet.startsWith('40')),
  );
  await welfare.goto(INBOX_ROOM);
  const welfareLog = welfare.getByRole('log', { name: /^Percakapan / });
  await expect(
    welfareLog.getByText('minggu ini tugasku menumpuk', { exact: false }),
  ).toBeVisible();
  await welfareConnected;

  await page
    .getByRole('textbox', { name: 'Tulis pesan untuk tim Welfare' })
    .fill(question);
  await page.getByRole('button', { name: 'Kirim pesan' }).click();
  await expect(memberLog.getByText(question)).toBeVisible();
  // Welfare's open room receives it over the socket, with no reload.
  await expect(welfareLog.getByText(question)).toBeVisible();

  await welfare
    .getByRole('textbox', { name: /^Tulis balasan untuk / })
    .fill(answer);
  await welfare.getByRole('button', { name: 'Kirim pesan' }).click();
  await expect(welfareLog.getByText(answer)).toBeVisible();
  await expect(memberLog.getByText(answer)).toBeVisible();

  // After a reload, the whole conversation is there, and the server counts nothing unread for her once she saw it.
  await page.reload();
  await expect(memberLog.getByText(question)).toBeVisible();
  await expect(memberLog.getByText(answer)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async (api) => {
        const res = await fetch(`${api}/api/curhat/chatrooms/unread`, {
          credentials: 'include',
        });
        if (!res.ok) return [`status ${res.status}`];
        const rooms = (await res.json()) as Array<{ chatroomId: string }>;
        return rooms.map((r) => r.chatroomId);
      }, REAL_API_URL),
    )
    .toEqual([]);

  expect(welfareProblems).toEqual([]);
  await welfareContext.close();
  void problems;
});
