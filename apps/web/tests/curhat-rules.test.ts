// P2-C: Curhat Yuk!'s rules (src/features/curhat/rules.ts), on the harness's data (the prototype's rooms, as the API
// sends them): the list's order, previews, times, initials and names; the thread; the room limit; the delivery
// states; Enter by pointer; unread counts; and Curhat kept out of the persisted cache.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildDb, NOW } from '../e2e/fixtures/api';
import type { Chatroom, ChatroomMessage } from '../src/api/generated';
import { CHATROOMS_QUERY_KEY } from '../src/api/constants';
import { shouldPersistKey } from '../src/api/persistence-policy';
import { ROOMS_KEY, UNREAD_KEY } from '../src/features/curhat/keys';
import {
  ACK_TIMEOUT_MS,
  ackOutcome,
  addUnread,
  buildThread,
  canReply,
  clearUnread,
  enterAction,
  isFull,
  lastMessage,
  listTime,
  MAX_ROOMS,
  outboxReducer,
  settleOutbox,
  previewOf,
  quoteText,
  roomInitials,
  roomName,
  roomsUsed,
  sortRooms,
  totalUnread,
  unreadByRoom,
  unreadSr,
  withMessage,
  type OutboxEntry,
  type ThreadMessage,
} from '../src/features/curhat/rules';

const now = new Date(NOW);
const rooms = () => buildDb('anggota').chatrooms;
const msg = (
  id: string,
  createdAt: string,
  isSender = false,
  extra: Partial<ChatroomMessage> = {},
): ChatroomMessage => ({
  id,
  chatroomId: 'x',
  replyId: null,
  content: `pesan ${id}`,
  createdAt,
  isSender,
  clientMessageId: null,
  ...extra,
});
const room = (id: string, messages: ChatroomMessage[]): Chatroom => ({
  id,
  title: `room ${id}`,
  messages,
  canDelete: true,
});

test('room names: lower-case names from the server get a capital per word; no name is "Ruang"', () => {
  assert.equal(roomName('teal koala'), 'Teal Koala');
  assert.equal(roomName('  amber   heron '), 'Amber Heron');
  assert.equal(roomName('Teal Koala'), 'Teal Koala');
  assert.equal(roomName(null), 'Ruang');
  assert.equal(roomName(''), 'Ruang');
});

test('initials: the first letter of each word, as roomIni', () => {
  assert.equal(roomInitials('Teal Koala'), 'TK');
  assert.equal(roomInitials('Amber Heron'), 'AH');
  assert.equal(roomInitials('Ruang'), 'R');
});

test('the fixture rooms come from the server in lower case', () => {
  assert.deepEqual(
    Object.values(rooms()).map((r) => r.title),
    ['teal koala', 'amber heron'],
  );
});

test('list order: newest message first, rooms without messages last in the server’s order', () => {
  const list = [
    room('empty-1', []),
    room('old', [msg('a', '2026-09-01T00:00:00Z')]),
    room('new', [
      msg('b', '2026-10-01T00:00:00Z'),
      msg('c', '2026-09-01T00:00:00Z'),
    ]),
    room('empty-2', []),
  ];
  assert.deepEqual(
    sortRooms(list).map((r) => r.id),
    ['new', 'old', 'empty-1', 'empty-2'],
  );
  assert.deepEqual(
    sortRooms(Object.values(rooms())).map((r) => r.id),
    ['r1', 'r2'],
  );
});

test('the newest message, whatever order they come in', () => {
  const r = room('r', [
    msg('a', '2026-09-01T00:00:00Z'),
    msg('b', '2026-10-01T00:00:00Z'),
  ]);
  assert.equal(lastMessage(r)?.id, 'b');
  assert.equal(lastMessage(room('e', [])), undefined);
});

test('previews: "Kamu: " or "Welfare: " and the last message, or "Belum ada pesan"', () => {
  const { r1, r2 } = rooms();
  assert.equal(
    previewOf(r1),
    'Welfare: Oke, coba kita susun bareng ya. Mau aku bantu bikin jadwal mingguan sampai UTS?',
  );
  assert.equal(
    previewOf(r2),
    'Welfare: Sama-sama! Kapan pun mau cerita lagi, ruang ini tetap ada.',
  );
  assert.equal(previewOf(room('m', [msg('a', NOW, true)])), 'Kamu: pesan a');
  assert.equal(previewOf(room('e', [])), 'Belum ada pesan');
});

test('list time: the clock today, the short date before (WIB)', () => {
  const { r1, r2 } = rooms();
  assert.equal(listTime(r1, now), '10.12');
  assert.equal(listTime(r2, now), 'Sen 14 Sep');
  assert.equal(listTime(room('e', []), now), '');
  // Days are WIB days: 00.10 WIB on 8 October is today (still 7 October in UTC); 23.30 WIB on 7 October is not.
  assert.equal(
    listTime(room('a', [msg('a', '2026-10-07T17:10:00Z')]), now),
    '00.10',
  );
  assert.equal(
    listTime(room('b', [msg('b', '2026-10-07T16:30:00Z')]), now),
    'Rab 7 Okt',
  );
});

test('"{n} dari 3 ruang dipakai", and full at three', () => {
  assert.equal(MAX_ROOMS, 3);
  assert.equal(roomsUsed(2), '2 dari 3 ruang dipakai');
  assert.equal(roomsUsed(0), '0 dari 3 ruang dipakai');
  assert.equal(isFull(2), false);
  assert.equal(isFull(3), true);
});

test('quotes are cut at 90 characters plus "…"', () => {
  const long = 'a'.repeat(95);
  assert.equal(quoteText(long), `${'a'.repeat(90)}…`);
  assert.equal(quoteText('a'.repeat(90)), 'a'.repeat(90));
});

const messages = (items: ReturnType<typeof buildThread>) =>
  items.filter((i): i is ThreadMessage => i.kind === 'message');

test('the thread: oldest first from the API’s newest-first list, day lines in WIB, quotes, the "Welfare" side', () => {
  const r1 = rooms().r1;
  assert.equal(r1.messages?.[0].id, 'm4', 'the API sends newest first');
  const items = buildThread(r1.messages, [], now);
  assert.deepEqual(
    items.map((i) => (i.kind === 'day' ? `— ${i.label}` : i.id)),
    [
      '— Senin, 5 Oktober',
      'm1',
      '— Selasa, 6 Oktober',
      'm2',
      'm3',
      '— Hari ini',
      'm4',
    ],
  );
  const [m1, m2, m3, m4] = messages(items);
  assert.equal(m1.mine, true);
  assert.equal(m2.mine, false);
  assert.equal(
    m4.quote,
    'Tubes 1 IF2110 Jumat ini, terus rapat kepanitiaan tiap Rabu malam.',
  );
  assert.equal(m1.quote, null);
});

test('a quote of a long message is cut; a quote of a message not in the list uses the one the API sent', () => {
  const long = 'b'.repeat(120);
  const items = messages(
    buildThread(
      [
        msg('q', '2026-10-08T01:00:00Z', false, { content: long }),
        msg('r', '2026-10-08T02:00:00Z', true, { replyId: 'q' }),
        msg('s', '2026-10-08T03:00:00Z', true, {
          replyId: 'gone',
          reply: {
            id: 'gone',
            chatroomId: 'x',
            replyId: null,
            content: 'dari API',
            createdAt: '2026-10-01T00:00:00Z',
          },
        }),
      ],
      [],
      now,
    ),
  );
  assert.equal(items[1].quote, `${'b'.repeat(90)}…`);
  assert.equal(items[2].quote, 'dari API');
});

const CLIENT_ID = '7f3c2a10-5b1e-4c8d-9a6f-0e2b4d6c8a11';
const entry = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
  localId: 'local-1',
  clientMessageId: CLIENT_ID,
  chatroomId: 'r1',
  text: 'Mau kak, makasih!',
  replyId: 'm4',
  status: 'pending',
  at: NOW,
  ...over,
});

test('delivery: history counts as delivered; only your newest delivered message says Terkirim', () => {
  const items = messages(buildThread(rooms().r1.messages, [], now));
  assert.ok(items.every((m) => m.delivery === 'delivered'));
  assert.deepEqual(
    items.filter((m) => m.newestDelivered).map((m) => m.id),
    ['m3'],
  );
  // Welfare's newer message doesn't take it: it is yours that are marked.
  const more = withMessage(rooms().r1.messages, msg('m9', NOW, true));
  assert.deepEqual(
    messages(buildThread(more, [], now))
      .filter((m) => m.newestDelivered)
      .map((m) => m.id),
    ['m9'],
  );
});

test('delivery: Mengirim, then Terkirim once acknowledged; pending and failed messages come last, without Balas', () => {
  let outbox = outboxReducer([], { type: 'send', entry: entry() });
  let items = messages(buildThread(rooms().r1.messages, outbox, now));
  const pending = items.at(-1)!;
  assert.equal(pending.delivery, 'pending');
  assert.equal(pending.id, null);
  assert.equal(pending.quote, rooms().r1.messages![0].content);
  assert.equal(canReply(pending), false);

  // Acknowledged: the server's copy takes the pending one's place, whether the rooms cache holds it yet or not.
  const saved = msg('e2e-message-1', NOW, true, {
    chatroomId: 'r1',
    replyId: 'm4',
    content: 'Mau kak, makasih!',
    clientMessageId: CLIENT_ID,
  });
  outbox = outboxReducer(outbox, {
    type: 'delivered',
    localId: 'local-1',
    message: saved,
  });
  assert.equal(outbox[0].status, 'delivered');
  for (const list of [
    rooms().r1.messages,
    withMessage(rooms().r1.messages, saved),
  ]) {
    items = messages(buildThread(list, outbox, now));
    const sent = items.at(-1)!;
    assert.equal(sent.id, 'e2e-message-1');
    assert.equal(sent.delivery, 'delivered');
    assert.equal(sent.newestDelivered, true);
    assert.equal(canReply(sent), true);
    assert.equal(items.filter((m) => m.newestDelivered).length, 1);
    assert.equal(items.filter((m) => m.text === 'Mau kak, makasih!').length, 1);
  }
});

// Review M2 (OPEN-QUESTIONS A11): saved by the server, its acknowledgement lost (Gagal). Once the rooms are fetched
// again, the server's copy with the same device id is the one shown, delivered, and the Gagal copy is gone.
test('delivery: a message saved whose acknowledgement was lost shows once, delivered, when the rooms hold it', () => {
  let outbox = outboxReducer([], { type: 'send', entry: entry() });
  outbox = outboxReducer(outbox, { type: 'failed', localId: 'local-1' });
  const saved = msg('e2e-message-1', NOW, true, {
    chatroomId: 'r1',
    replyId: 'm4',
    content: 'Mau kak, makasih!',
    clientMessageId: CLIENT_ID,
  });
  const list = withMessage(rooms().r1.messages, saved);
  const items = messages(buildThread(list, outbox, now));
  const copies = items.filter((m) => m.text === 'Mau kak, makasih!');
  assert.equal(copies.length, 1);
  assert.equal(copies[0].delivery, 'delivered');
  assert.equal(copies[0].newestDelivered, true);
  assert.deepEqual(settleOutbox(outbox, { r1: { messages: list } }), {
    settled: ['local-1'],
    restore: [],
  });
  // Another message of yours with the same text but another id is not it.
  const other = { ...saved, id: 'm-lain', clientMessageId: 'lain' };
  assert.deepEqual(
    settleOutbox(outbox, {
      r1: { messages: withMessage(rooms().r1.messages, other) },
    }),
    { settled: [], restore: [] },
  );
});

// Review minor 1: a refetch that started before the save lands with an older list and drops a delivered message.
test('settling: a delivered message the rooms lost is put back; one they hold is settled; unknown rooms wait', () => {
  const saved = msg('e2e-message-1', NOW, true, {
    chatroomId: 'r1',
    clientMessageId: CLIENT_ID,
  });
  let outbox = outboxReducer([], { type: 'send', entry: entry() });
  outbox = outboxReducer(outbox, {
    type: 'delivered',
    localId: 'local-1',
    message: saved,
  });
  assert.deepEqual(settleOutbox(outbox, { r1: room('r1', []) }), {
    settled: [],
    restore: [saved],
  });
  assert.deepEqual(settleOutbox(outbox, { r1: room('r1', [saved]) }), {
    settled: ['local-1'],
    restore: [],
  });
  assert.deepEqual(settleOutbox(outbox, undefined), {
    settled: [],
    restore: [],
  });
  assert.deepEqual(settleOutbox(outbox, { r2: room('r2', []) }), {
    settled: [],
    restore: [],
  });
  // A pending or failed message the rooms don't hold stays as it is.
  const waiting = outboxReducer([], { type: 'send', entry: entry() });
  assert.deepEqual(settleOutbox(waiting, { r1: room('r1', []) }), {
    settled: [],
    restore: [],
  });
  assert.deepEqual(
    outboxReducer(outbox, { type: 'settled', localIds: ['local-1'] }),
    [],
  );
});

test('delivery: Gagal on failure, Kirim ulang sends it again; a deleted room takes its messages', () => {
  let outbox = outboxReducer([], { type: 'send', entry: entry() });
  outbox = outboxReducer(outbox, { type: 'failed', localId: 'local-1' });
  const failed = messages(buildThread([], outbox, now))[0];
  assert.equal(failed.delivery, 'failed');
  assert.equal(canReply(failed), false);
  // A late failure for a message already settled changes nothing.
  assert.deepEqual(
    outboxReducer(outbox, { type: 'failed', localId: 'nope' }),
    outbox,
  );
  outbox = outboxReducer(outbox, {
    type: 'retry',
    localId: 'local-1',
    at: '2026-10-08T06:40:00.000Z',
  });
  assert.equal(outbox[0].status, 'pending');
  assert.equal(outbox[0].at, '2026-10-08T06:40:00.000Z');
  // Only a failed message can be sent again.
  assert.deepEqual(
    outboxReducer(outbox, { type: 'retry', localId: 'local-1', at: NOW }),
    outbox,
  );
  assert.deepEqual(
    outboxReducer(outbox, { type: 'dropRoom', chatroomId: 'r1' }),
    [],
  );
});

test('acknowledgements: only { ok: true, message } is delivered', () => {
  const m = msg('a', NOW, true);
  assert.deepEqual(ackOutcome({ ok: true, message: m }), {
    ok: true,
    message: m,
  });
  assert.deepEqual(ackOutcome({ ok: false, error: 'forbidden' }), {
    ok: false,
    error: 'forbidden',
  });
  assert.deepEqual(ackOutcome({ ok: false, error: 'other' }), { ok: false });
  assert.deepEqual(ackOutcome({ ok: true }), { ok: false });
  assert.deepEqual(ackOutcome(undefined), { ok: false });
  assert.equal(ACK_TIMEOUT_MS, 10_000);
});

test('a message is put in its room once, newest first', () => {
  const list = withMessage([msg('a', '2026-10-01T00:00:00Z')], msg('b', NOW));
  assert.deepEqual(
    list.map((m) => m.id),
    ['b', 'a'],
  );
  assert.equal(withMessage(list, msg('b', NOW)), list);
});

test('Enter: a new line on touch keyboards, sends with a fine pointer, Shift+Enter a new line, not while composing', () => {
  const key = (o: Partial<Parameters<typeof enterAction>[0]>) =>
    enterAction({
      key: 'Enter',
      shiftKey: false,
      isComposing: false,
      coarse: false,
      ...o,
    });
  assert.equal(key({}), 'send');
  assert.equal(key({ shiftKey: true }), 'newline');
  assert.equal(key({ coarse: true }), 'newline');
  assert.equal(key({ coarse: true, shiftKey: true }), 'newline');
  assert.equal(key({ isComposing: true }), 'none');
  assert.equal(key({ key: 'a' }), 'none');
});

test('unread: per room and in total, from the server’s rows; counting and clearing', () => {
  const rows = buildDb('anggota');
  // The harness answers the unread route from the read marks: m4 is Nadia's only unread message.
  const fromServer = Object.values(rows.chatrooms).map((r) => ({
    chatroomId: r.id,
    unreadCount: (r.messages ?? []).filter(
      (m) => !m.isSender && !rows.chatroomReads.includes(m.id),
    ).length,
  }));
  assert.deepEqual(unreadByRoom(fromServer), { r1: 1 });
  assert.equal(totalUnread(fromServer), 1);
  const more = addUnread(addUnread(fromServer, 'r2'), 'r1');
  assert.deepEqual(unreadByRoom(more), { r1: 2, r2: 1 });
  assert.equal(totalUnread(more), 3);
  assert.deepEqual(unreadByRoom(clearUnread(more, 'r1')), { r2: 1 });
  assert.equal(totalUnread(undefined), 0);
  assert.equal(unreadSr(1), ', 1 pesan baru');
  assert.equal(unreadSr(0), '');
});

test('Curhat is never written to the persisted query cache', () => {
  assert.deepEqual(ROOMS_KEY, [CHATROOMS_QUERY_KEY]);
  assert.deepEqual(UNREAD_KEY, [CHATROOMS_QUERY_KEY, 'unread']);
  assert.equal(shouldPersistKey(ROOMS_KEY, now), false);
  assert.equal(shouldPersistKey(UNREAD_KEY, now), false);
});
