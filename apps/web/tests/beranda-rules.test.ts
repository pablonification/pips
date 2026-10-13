// P1-A: Beranda's rules (brief rules 4–7): follow-ups in order and from their signals only, Welfare replies from
// your own rooms, the Kelola summary's form, the unread list.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type {
  AdminFormListItem,
  CalendarEvent,
  Chatroom,
  FormListItem,
  Info,
} from '../src/api/generated';
import {
  attentionItems,
  kelolaForm,
  postTitle,
  unreadTop,
  welfareRooms,
} from '../src/features/beranda/rules';

process.env.TZ = 'America/Los_Angeles';

const wib = (s: string) => new Date(`${s}:00+07:00`).toISOString();
const NOW = Date.parse(wib('2026-10-08T13:35'));

const ev = (
  id: string,
  title: string,
  start: string,
  end = start,
): CalendarEvent => ({
  id,
  calendarGroupId: 'g',
  courseId: null,
  title,
  description: '',
  category: 'akademik',
  academicYear: 2026,
  academicSemesterCode: 'Ganjil',
  start: wib(start),
  end: wib(end),
  googleCalendarUrl: '',
  googleCalendarId: '',
});

const form = (
  id: string,
  status: FormListItem['status'],
  sectionCount = 5,
): FormListItem => ({
  id,
  slug: id,
  title: `Form ${id}`,
  description: null,
  eligibleAngkatan: [2025],
  opensAt: wib('2026-09-12T13:00'),
  closesAt: null,
  isActive: true,
  order: 0,
  createdAt: wib('2026-09-01T00:00'),
  status,
  sectionCount,
});

const room = (
  id: string,
  canDelete: boolean,
  msgs: Array<[sender: boolean, at: string]>,
): Chatroom => ({
  id,
  title: `Ruang ${id}`,
  canDelete,
  messages: msgs.map(([isSender, at], i) => ({
    id: `${id}-m${i}`,
    chatroomId: id,
    replyId: null,
    content: 'rahasia',
    createdAt: wib(at),
    isSender,
  })),
});

const tubes = ev('a3', 'Deadline Tugas Besar 1', '2026-10-09T23:59');
const todayDeadline = ev('d0', 'Kumpul laporan', '2026-10-08T20:00');
const pastDeadline = ev('d1', 'Lewat', '2026-10-08T09:00');
const farDeadline = ev('d2', 'Deadline Milestone 1', '2026-10-14T23:59');
const kuis = ev('a2', 'Kuis 2', '2026-10-08T15:00', '2026-10-08T16:40');

test('Welfare replies: only your rooms, only Welfare’s messages, only rooms the count names; latest first', () => {
  const rooms = {
    r1: room('r1', true, [
      [false, '2026-10-08T10:12'],
      [true, '2026-10-07T21:00'],
      [false, '2026-10-07T21:05'],
    ]),
    r2: room('r2', true, [[false, '2026-10-08T11:00']]),
    // Someone else's room in a Welfare member's list: never counted.
    r3: room('r3', false, [[false, '2026-10-08T12:00']]),
    // Your room with only your own messages.
    r4: room('r4', true, [[true, '2026-10-08T12:30']]),
  };
  assert.deepEqual(
    welfareRooms(rooms, [{ chatroomId: 'r1', unreadCount: 1 }]),
    [{ id: 'r1', latestReply: wib('2026-10-08T10:12') }],
  );
  assert.deepEqual(
    welfareRooms(rooms, [
      { chatroomId: 'r1', unreadCount: 1 },
      { chatroomId: 'r2', unreadCount: 2 },
      { chatroomId: 'r3', unreadCount: 4 },
      { chatroomId: 'r4', unreadCount: 1 },
      { chatroomId: 'gone', unreadCount: 1 },
    ]).map((r) => r.id),
    ['r2', 'r1'],
  );
  assert.deepEqual(welfareRooms(rooms, []), []);
  assert.deepEqual(
    welfareRooms(undefined, [{ chatroomId: 'r1', unreadCount: 1 }]),
    [],
  );
});

test('follow-ups in order: deadlines today or tomorrow, Welfare, open forms, no courses, notifications last', () => {
  const items = attentionItems({
    now: NOW,
    events: [farDeadline, tubes, kuis, pastDeadline, todayDeadline],
    welfare: [{ id: 'r1', latestReply: wib('2026-10-08T10:12') }],
    forms: [
      form('pixel', 'open', 5),
      form('done', 'already_responded'),
      form('soon', 'not_opened'),
      form('shut', 'closed'),
    ],
    courses: [],
    pushOff: true,
  });
  assert.deepEqual(
    items.map((i) =>
      i.kind === 'deadline'
        ? `deadline:${i.event.id}`
        : i.kind === 'form'
          ? `form:${i.form.id}`
          : i.kind,
    ),
    ['deadline:d0', 'deadline:a3', 'curhat', 'form:pixel', 'courses', 'push'],
  );
});

test('each row goes with its signal; nothing to do is an empty list', () => {
  assert.deepEqual(
    attentionItems({
      now: NOW,
      events: [kuis],
      welfare: [],
      forms: [form('x', 'already_responded')],
      courses: [{}],
      pushOff: false,
    }),
    [],
  );
  // Courses still loading: no "Atur mata kuliah" row yet.
  assert.deepEqual(
    attentionItems({
      now: NOW,
      events: [],
      welfare: [],
      forms: undefined,
      courses: undefined,
      pushOff: false,
    }),
    [],
  );
  // Raka: only his deadline (notifications on, courses set, no forms for 2024).
  const raka = attentionItems({
    now: NOW,
    events: [tubes],
    welfare: [],
    forms: [],
    courses: [{}],
    pushOff: false,
  });
  assert.deepEqual(
    raka.map((i) => i.kind),
    ['deadline'],
  );
});

test('several Welfare rooms are one row', () => {
  const items = attentionItems({
    now: NOW,
    events: [],
    welfare: [
      { id: 'r2', latestReply: wib('2026-10-08T11:00') },
      { id: 'r1', latestReply: wib('2026-10-08T10:12') },
    ],
    forms: [],
    courses: [{}],
    pushOff: false,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind === 'curhat' && items[0].rooms.length, 2);
});

const admin = (
  id: string,
  extra: Partial<AdminFormListItem> = {},
): AdminFormListItem => ({
  id,
  slug: id,
  title: `Form ${id}`,
  description: null,
  eligibleAngkatan: [2025],
  opensAt: wib('2026-09-12T13:00'),
  closesAt: null,
  isActive: true,
  order: 0,
  createdAt: wib('2026-09-01T00:00'),
  ...extra,
});

test('the Kelola form: the first active, opened, not closed one in the list’s order', () => {
  assert.equal(kelolaForm([admin('pixel'), admin('two')], NOW)?.id, 'pixel');
  assert.equal(
    kelolaForm(
      [
        admin('off', { isActive: false }),
        admin('later', { opensAt: wib('2026-11-01T00:00') }),
        admin('shut', { closesAt: wib('2026-10-01T00:00') }),
        admin('open', { closesAt: wib('2026-10-20T00:00') }),
      ],
      NOW,
    )?.id,
    'open',
  );
  assert.equal(kelolaForm([admin('off', { isActive: false })], NOW), null);
  assert.equal(kelolaForm(undefined, NOW), null);
});

const info = (
  id: string,
  at: string,
  isRead: boolean,
  title = `Judul ${id}`,
): Info =>
  ({ id, title, content: `Isi ${id}`, createdAt: wib(at), isRead }) as Info;

test('unread list: the three newest unread, a post without a title by its text', () => {
  const list = [
    info('p1', '2026-10-08T12:30', false),
    info('p2', '2026-10-08T10:40', true),
    info('p3', '2026-10-07T09:00', false),
    info('p4', '2026-10-08T13:00', false),
    info('p5', '2026-10-06T09:00', false),
  ];
  assert.deepEqual(
    unreadTop(list).map((i) => i.id),
    ['p4', 'p1', 'p3'],
  );
  assert.deepEqual(unreadTop(undefined), []);
  assert.equal(postTitle(info('p6', '2026-10-01T00:00', false, '')), 'Isi p6');
});
