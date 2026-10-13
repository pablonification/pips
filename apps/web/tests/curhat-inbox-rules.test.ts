// P3-C: the Welfare inbox's rules (src/features/curhat-inbox/rules.ts), on the harness's Welfare view (Raka with
// curhatadmin: every room, the member's messages fromOwner), under a time zone that isn't WIB.
process.env.TZ = 'America/Los_Angeles';

import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { buildDb, NOW } from '../e2e/fixtures/api';
import type { Chatroom, ChatroomMessage } from '../src/api/generated';
import { shouldPersistKey } from '../src/api/persistence-policy';
import { ROOMS_KEY, UNREAD_KEY } from '../src/features/curhat/keys';
import {
  buildThread,
  type OutboxEntry,
  type ThreadMessage,
} from '../src/features/curhat/rules';
import {
  deliveredOnly,
  failedWasSaved,
  inboxPreview,
  inboxSpeakerSr,
  inboxTimeLine,
  inboxView,
  matchesSearch,
  mayAnswerCurhat,
  onWelfareSide,
  sendPlan,
  speakerOf,
  writeFailure,
} from '../src/features/curhat-inbox/rules';
import { kelolaAccess, kelolaServices } from '../src/features/kelola/rules';
import { visibleServices } from '../src/lib/services';

const welfareDb = () => buildDb('pengurus', ['curhatadmin']);
const welfare = welfareDb().me!;
const onlyWelfare = buildDb('pengurus', { only: ['curhatadmin'] }).me!;
const raka = buildDb('pengurus').me!;
const nadia = buildDb('anggota').me!;
const rooms = () => Object.values(welfareDb().chatrooms);
const byRoom = (db = welfareDb()) => {
  const counts: Record<string, number> = {};
  for (const r of Object.values(db.chatrooms))
    for (const m of r.messages ?? [])
      if (!m.isSender && !db.chatroomReads.includes(m.id))
        counts[r.id] = (counts[r.id] ?? 0) + 1;
  return counts;
};

const msg = (
  id: string,
  over: Partial<ChatroomMessage> = {},
): ChatroomMessage => ({
  id,
  chatroomId: 'x',
  replyId: null,
  content: `pesan ${id}`,
  createdAt: NOW,
  isSender: false,
  fromOwner: true,
  clientMessageId: null,
  ...over,
});
const room = (
  id: string,
  messages: ChatroomMessage[],
  isPinned = false,
): Chatroom => ({
  id,
  title: `ruang ${id}`,
  messages,
  isPinned,
  canDelete: false,
});

// ---------- 1. Who sees it ----------

test('the inbox, its Kelola row and the pin are curhatadmin’s only', () => {
  assert.equal(mayAnswerCurhat(welfare), true);
  assert.equal(mayAnswerCurhat(raka), false);
  assert.equal(mayAnswerCurhat(nadia), false);
  assert.equal(mayAnswerCurhat(null), false);

  assert.deepEqual(kelolaAccess(welfare, 'curhat'), { allowed: true });
  // Raka without curhatadmin has other Kelola tools: back to the hub. Nadia has none: Layanan.
  assert.deepEqual(kelolaAccess(raka, 'curhat'), {
    allowed: false,
    to: '/kelola',
  });
  assert.deepEqual(kelolaAccess(nadia, 'curhat'), {
    allowed: false,
    to: '/layanan',
  });

  const row = (u: Parameters<typeof kelolaServices>[0]) =>
    kelolaServices(u).find((s) => s.id === 'curhat-inbox');
  assert.equal(row(raka), undefined);
  assert.equal(row(nadia), undefined);
  assert.deepEqual(
    [row(welfare)?.label, row(welfare)?.destination, row(welfare)?.icon],
    ['Curhat Yuk!', '/kelola/curhat', 'curhat'],
  );
  // The row comes after the Kelola rows already there.
  assert.deepEqual(
    kelolaServices(welfare).map((s) => s.id),
    ['live', 'sparta-data', 'acara', 'curhat-inbox'],
  );
  // Welfare with no other tool: Kelola holds the Curhat row only, and the hub lets them in.
  assert.deepEqual(
    kelolaServices(onlyWelfare).map((s) => s.id),
    ['curhat-inbox'],
  );
  assert.deepEqual(kelolaAccess(onlyWelfare, 'hub'), { allowed: true });
  assert.ok(
    !visibleServices(nadia).some((s) => s.id === 'curhat-inbox'),
    'members never see it',
  );
});

// ---------- 2. Order ----------

test('pinned first, then newest message first, rooms without messages last', () => {
  const list = [
    room('kosong', []),
    room('lama', [msg('a', { createdAt: '2026-10-01T03:00:00.000Z' })]),
    room('baru', [msg('b', { createdAt: '2026-10-08T03:00:00.000Z' })]),
    room(
      'pin-lama',
      [msg('c', { createdAt: '2026-09-01T03:00:00.000Z' })],
      true,
    ),
    room('pin-kosong', [], true),
  ];
  const view = inboxView(list, {}, {});
  assert.deepEqual(
    view.pinned.map((r) => r.id),
    ['pin-lama', 'pin-kosong'],
  );
  assert.deepEqual(
    view.rest.map((r) => r.id),
    ['baru', 'lama', 'kosong'],
  );
  assert.equal(view.empty, null);
});

test('on the harness: Teal Koala (newest) then Amber Heron; pinning Amber Heron moves it up', () => {
  const all = rooms();
  assert.deepEqual(
    inboxView(all, {}, byRoom()).rest.map((r) => r.id),
    ['r1', 'r2'],
  );
  const pinned = all.map((r) => (r.id === 'r2' ? { ...r, isPinned: true } : r));
  const view = inboxView(pinned, {}, byRoom());
  assert.deepEqual(
    [view.pinned.map((r) => r.id), view.rest.map((r) => r.id)],
    [['r2'], ['r1']],
  );
});

// ---------- 3. Search and the unread toggle ----------

test('search: the room name or any message, case-insensitive and trimmed, from the first character', () => {
  const [r1] = rooms();
  assert.equal(matchesSearch(r1, ''), true);
  assert.equal(matchesSearch(r1, '   '), true);
  assert.equal(matchesSearch(r1, 'teal'), true);
  assert.equal(matchesSearch(r1, '  TEAL koala '), true);
  assert.equal(matchesSearch(r1, 't'), true);
  // A word from a message (m3: "Tubes 1 IF2110 Jumat ini, …").
  assert.equal(matchesSearch(r1, 'kepanitiaan'), true);
  assert.equal(matchesSearch(r1, 'if2110'), true);
  assert.equal(matchesSearch(r1, 'heron'), false);
});

test('the unread toggle keeps rooms with unread messages, and combines with the search', () => {
  const counts = byRoom();
  // Welfare's read marks: m1 and m3 unread in Teal Koala, m5 read in Amber Heron.
  assert.deepEqual(counts, { r1: 2 });
  assert.deepEqual(
    inboxView(rooms(), { unread: true }, counts).rest.map((r) => r.id),
    ['r1'],
  );
  assert.deepEqual(
    inboxView(rooms(), { unread: true, q: 'heron' }, counts).empty,
    'noMatch',
  );
  assert.deepEqual(
    inboxView(rooms(), { q: 'lega' }, counts).rest.map((r) => r.id),
    ['r2'],
  );
});

test('the empty states: no rooms, no match, nothing unread', () => {
  assert.equal(inboxView([], {}, {}).empty, 'none');
  assert.equal(inboxView([], { q: 'x', unread: true }, {}).empty, 'none');
  assert.equal(inboxView(rooms(), { q: 'zzz' }, byRoom()).empty, 'noMatch');
  assert.equal(inboxView(rooms(), { unread: true }, {}).empty, 'allRead');
});

// ---------- 4. Sides and prefixes ----------

test('fromOwner decides the side; isSender decides "Kamu"; a Welfare message that is not yours is "Welfare"', () => {
  assert.equal(speakerOf({ isSender: true, fromOwner: false }), 'kamu');
  assert.equal(speakerOf({ isSender: false, fromOwner: false }), 'welfare');
  assert.equal(speakerOf({ isSender: false, fromOwner: true }), 'anggota');
  assert.equal(onWelfareSide({ fromOwner: false }), true);
  assert.equal(onWelfareSide({ fromOwner: true }), false);

  const [r1, r2] = rooms();
  // The previews on the harness: Welfare's own last message, then the member's.
  assert.equal(
    inboxPreview(r1),
    'Kamu: Oke, coba kita susun bareng ya. Mau aku bantu bikin jadwal mingguan sampai UTS?',
  );
  assert.equal(
    inboxPreview({
      ...r2,
      messages: [msg('n', { content: 'Halo kak' }), ...(r2.messages ?? [])],
    }),
    'Anggota: Halo kak',
  );
  assert.equal(
    inboxPreview({
      ...r2,
      messages: [
        msg('t', { content: 'Dari tim', fromOwner: false }),
        ...(r2.messages ?? []),
      ],
    }),
    'Welfare: Dari tim',
  );
  assert.equal(inboxPreview(room('kosong', [])), 'Belum ada pesan');
});

test('time lines and screen-reader prefixes in WIB: "10.12", "Welfare · 10.12", "Teal Koala · 10.12"', () => {
  const at = '2026-10-08T03:12:00.000Z'; // 10.12 WIB
  const thread = buildThread(
    [
      msg('mine', { isSender: true, fromOwner: false, createdAt: at }),
      msg('mate', { isSender: false, fromOwner: false, createdAt: at }),
      msg('member', { isSender: false, fromOwner: true, createdAt: at }),
    ],
    [],
    Date.parse(NOW),
  ).filter((i): i is ThreadMessage => i.kind === 'message');
  const byId = Object.fromEntries(thread.map((m) => [m.id, m]));
  assert.equal(inboxTimeLine(byId.mine, 'Teal Koala'), '10.12');
  assert.equal(inboxTimeLine(byId.mate, 'Teal Koala'), 'Welfare · 10.12');
  assert.equal(inboxTimeLine(byId.member, 'Teal Koala'), 'Teal Koala · 10.12');
  assert.equal(inboxSpeakerSr(byId.mine, 'Teal Koala'), 'Kamu: ');
  assert.equal(inboxSpeakerSr(byId.mate, 'Teal Koala'), 'Welfare: ');
  assert.equal(inboxSpeakerSr(byId.member, 'Teal Koala'), 'Teal Koala: ');
  assert.deepEqual(
    thread.map((m) => onWelfareSide(m)),
    [true, true, false],
  );
});

// ---------- 5. Writes never sign out ----------

test('a 401 or 403 from a write is "no access", never "signed out"; anything else the general line', () => {
  assert.equal(writeFailure(401), 'ditolak');
  assert.equal(writeFailure(403), 'ditolak');
  assert.equal(writeFailure(500), 'gagal');
  assert.equal(writeFailure(400), 'gagal');
  assert.equal(writeFailure(undefined), 'gagal');
});

test('the pin item never signs out: its failure goes through the toast and useRoleLoss only', () => {
  const src = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      '../src/features/curhat-inbox/PinMenu.tsx',
    ),
    'utf8',
  );
  assert.match(src, /useRoleLoss\(pin\.error\)/);
  assert.doesNotMatch(src, /signOut|logout|forgetMember|removeQueries/i);
});

// ---------- Sending ----------

const entry = (
  localId: string,
  status: OutboxEntry['status'],
): OutboxEntry => ({
  localId,
  clientMessageId: `id-${localId}`,
  chatroomId: 'r1',
  text: 'Siap, aku kirim jadwalnya ya.',
  replyId: 'm3',
  status,
  at: NOW,
});

test('sending again unchanged reuses the failed reply’s device id; changed text or quote is a new message', () => {
  const failed = {
    localId: 'local-1',
    text: 'Siap, aku kirim jadwalnya ya.',
    replyId: 'm3',
  };
  const outbox = [entry('local-1', 'failed')];
  assert.deepEqual(
    sendPlan(failed, 'Siap, aku kirim jadwalnya ya.', 'm3', outbox),
    { kind: 'retry', localId: 'local-1' },
  );
  assert.deepEqual(sendPlan(failed, 'Siap, aku kirim ya.', 'm3', outbox), {
    kind: 'send',
  });
  assert.deepEqual(
    sendPlan(failed, 'Siap, aku kirim jadwalnya ya.', null, outbox),
    { kind: 'send' },
  );
  assert.deepEqual(sendPlan(null, 'x', null, outbox), { kind: 'send' });
});

// Review M1 (round 2): round 1 expected `send` here, which saved the reply twice after a reconnect's catch-up fetch.
test('a failed reply whose entry has settled or been delivered is saved: sending it unchanged sends nothing', () => {
  const failed = {
    localId: 'local-1',
    text: 'Siap, aku kirim jadwalnya ya.',
    replyId: 'm3',
  };
  // The failed entry has gone (the server's copy settled it).
  assert.deepEqual(
    sendPlan(failed, 'Siap, aku kirim jadwalnya ya.', 'm3', []),
    { kind: 'saved' },
  );
  assert.deepEqual(
    sendPlan(failed, 'Siap, aku kirim jadwalnya ya.', 'm3', [
      entry('local-1', 'delivered'),
    ]),
    { kind: 'saved' },
  );
  // Changed text or quote is still a new message.
  assert.deepEqual(sendPlan(failed, 'Siap, aku kirim ya.', 'm3', []), {
    kind: 'send',
  });
  assert.deepEqual(
    sendPlan(failed, 'Siap, aku kirim jadwalnya ya.', null, []),
    { kind: 'send' },
  );
  assert.equal(failedWasSaved(failed, []), true);
  assert.equal(failedWasSaved(failed, [entry('local-1', 'delivered')]), true);
  assert.equal(failedWasSaved(failed, [entry('local-1', 'failed')]), false);
  assert.equal(failedWasSaved(failed, [entry('local-1', 'pending')]), false);
  assert.equal(failedWasSaved(failed, [entry('local-2', 'failed')]), true);
});

test('the inbox draws only delivered replies: no Mengirim or Gagal bubble', () => {
  const outbox = [
    entry('p', 'pending'),
    entry('f', 'failed'),
    entry('d', 'delivered'),
  ];
  assert.deepEqual(
    deliveredOnly(outbox).map((e) => e.localId),
    ['d'],
  );
});

// ---------- Privacy ----------

test('Curhat data is never written to the device, the inbox included', () => {
  assert.equal(shouldPersistKey(ROOMS_KEY), false);
  assert.equal(shouldPersistKey(UNREAD_KEY), false);
  // The inbox keeps its data under the member side's keys only.
  const dir = path.resolve(import.meta.dirname, '../src/features/curhat-inbox');
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const [k] of src.matchAll(/queryKey:\s*[^,}\n]+/g))
      assert.match(k, /ROOMS_KEY|UNREAD_KEY/, `${f}: ${k}`);
    assert.doesNotMatch(src, /localStorage|sessionStorage|console\./, f);
  }
});
