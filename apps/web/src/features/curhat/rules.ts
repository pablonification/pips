/**
 * Curhat Yuk!'s rules (P2-C), pure so tests/curhat-rules.test.ts checks them without a browser: the list's order,
 * previews and times, a room's thread (oldest first, day separators in WIB, quotes), the delivery states of what you
 * send, the Enter key by pointer type, and unread counts. From the prototype (garis/state.js `MAX_ROOMS`,
 * `roomUnread`, `curhatUnread`; screens-more.js `roomIni`, `scrCurhat`, `scrRoom`; app.js `titleOf`) and today's
 * screen (`sortChats` in layanan/curhat/-components/chatlist.tsx).
 */
import type { Chatroom, ChatroomMessage } from '~/api/generated';
import { curhat as t } from '~/copy/curhat';
import { fill } from '~/copy/fill';
import { dayDiff, dLong, dShort, hm, wib } from '~/lib/dates';

/** At most three rooms per member; the server refuses a fourth with 400 (state.js `MAX_ROOMS`). */
export const MAX_ROOMS = 3;
/** A message with no acknowledgement after this long has failed (SPEC story 96). */
export const ACK_TIMEOUT_MS = 10_000;
/** Quotes are cut after this many characters, then "…" (scrRoom). */
export const QUOTE_MAX = 90;

/**
 * A room's name as the member sees it. The server names rooms in lower case ("teal koala"); like the prototype and
 * today's screen, each word starts with a capital, as a name. A room without a name is "Ruang" (`titleOf`).
 */
export function roomName(title: string | null | undefined): string {
  const words = (title ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return t.ruang.tanpaNama;
  return words.map((w) => w[0].toLocaleUpperCase('id') + w.slice(1)).join(' ');
}

/** The gold square's letters: the first letter of each word of the name ("TK"), as `roomIni`. */
export function roomInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toLocaleUpperCase('id'))
    .join('');
}

const time = (m: { createdAt: string }) => Date.parse(m.createdAt);

/** A room's newest message, whatever order the messages come in (the API sends them newest first). */
export function lastMessage(room: Chatroom): ChatroomMessage | undefined {
  let last: ChatroomMessage | undefined;
  for (const m of room.messages ?? [])
    if (!last || time(m) > time(last)) last = m;
  return last;
}

/** Newest message first; rooms without messages last, in the server's order (today's `sortChats`). Members have no pins. */
export function sortRooms(rooms: Chatroom[]): Chatroom[] {
  return [...rooms].sort((a, b) => {
    const la = lastMessage(a);
    const lb = lastMessage(b);
    if (!la && !lb) return 0;
    if (!la) return 1;
    if (!lb) return -1;
    return time(lb) - time(la);
  });
}

/** The row's second line: "Kamu: …" or "Welfare: …", or "Belum ada pesan". */
export function previewOf(room: Chatroom): string {
  const last = lastMessage(room);
  if (!last) return t.daftar.belumAdaPesan;
  return fill(t.daftar.pratinjau, {
    siapa: last.isSender ? t.daftar.kamu : t.daftar.welfare,
    pesan: last.content,
  });
}

/** The row's time: "10.12" today, "Sen 14 Sep" before (WIB). Empty without messages. */
export function listTime(room: Chatroom, now: Date | number): string {
  const last = lastMessage(room);
  if (!last) return '';
  return dayDiff(last.createdAt, now) === 0
    ? hm(last.createdAt)
    : dShort(last.createdAt);
}

/** "{n} dari 3 ruang dipakai". */
export function roomsUsed(n: number): string {
  return fill(t.daftar.dipakai, { jumlah: n, maks: MAX_ROOMS });
}

export const isFull = (n: number) => n >= MAX_ROOMS;

/** A quote as a bubble shows it: at most 90 characters, then "…". */
export function quoteText(text: string): string {
  return text.length > QUOTE_MAX ? `${text.slice(0, QUOTE_MAX)}…` : text;
}

/* ================= Sending ================= */

/** A message you sent that the server hasn't acknowledged yet (`pending`), or that failed (`failed`). */
export interface OutboxEntry {
  localId: string;
  chatroomId: string;
  text: string;
  replyId: string | null;
  status: 'pending' | 'failed';
  /** When it was (last) sent, ISO. */
  at: string;
}

export type OutboxAction =
  | { type: 'send'; entry: OutboxEntry }
  | { type: 'delivered'; localId: string }
  | { type: 'failed'; localId: string }
  | { type: 'retry'; localId: string; at: string }
  | { type: 'dropRoom'; chatroomId: string };

/**
 * What you sent and the server hasn't confirmed. Delivered messages leave it (the server's copy takes their place in
 * the room); failed ones stay until Kirim ulang delivers them or the room is deleted.
 */
export function outboxReducer(
  state: OutboxEntry[],
  action: OutboxAction,
): OutboxEntry[] {
  switch (action.type) {
    case 'send':
      return [...state, action.entry];
    case 'delivered':
      return state.filter((e) => e.localId !== action.localId);
    case 'failed':
      return state.map((e) =>
        e.localId === action.localId && e.status === 'pending'
          ? { ...e, status: 'failed' }
          : e,
      );
    case 'retry':
      return state.map((e) =>
        e.localId === action.localId && e.status === 'failed'
          ? { ...e, status: 'pending', at: action.at }
          : e,
      );
    case 'dropRoom':
      return state.filter((e) => e.chatroomId !== action.chatroomId);
  }
}

/** What the server answered a `message` with (or didn't): delivered, or failed. */
export function ackOutcome(
  ack: unknown,
): { ok: true; message: ChatroomMessage } | { ok: false } {
  if (
    ack &&
    typeof ack === 'object' &&
    (ack as { ok?: unknown }).ok === true &&
    (ack as { message?: unknown }).message
  )
    return { ok: true, message: (ack as { message: ChatroomMessage }).message };
  return { ok: false };
}

/** Puts a message into a room's list (newest first, as the API sends them), once: a repeat with its id is ignored. */
export function withMessage(
  messages: ChatroomMessage[] | undefined,
  message: ChatroomMessage,
): ChatroomMessage[] {
  const list = messages ?? [];
  if (list.some((m) => m.id === message.id)) return list;
  return [message, ...list].sort((a, b) => time(b) - time(a));
}

/* ================= The thread ================= */

export type Delivery = 'pending' | 'failed' | 'delivered';

export interface ThreadMessage {
  kind: 'message';
  key: string;
  /** The server's id; null while it is pending or failed (you can't reply to it yet). */
  id: string | null;
  localId?: string;
  mine: boolean;
  text: string;
  at: string;
  /** The quoted message's text, cut to 90 characters. */
  quote: string | null;
  delivery: Delivery;
  /** Your newest delivered message: "Terkirim". */
  newestDelivered: boolean;
}
export interface ThreadDay {
  kind: 'day';
  key: string;
  label: string;
}
export type ThreadItem = ThreadMessage | ThreadDay;

const dayKey = (at: string) => {
  const w = wib(at);
  return `${w.year}-${w.month}-${w.day}`;
};

/**
 * A room's thread as scrRoom draws it: oldest first, a day line before each new WIB day ("Hari ini" or "Selasa,
 * 6 Oktober"), then what you sent that isn't confirmed yet, last. History from the server counts as delivered.
 */
export function buildThread(
  messages: ChatroomMessage[] | undefined,
  outbox: OutboxEntry[],
  now: Date | number,
): ThreadItem[] {
  const server = [...(messages ?? [])].sort((a, b) => time(a) - time(b));
  const byId = new Map(server.map((m) => [m.id, m]));
  const quoteOf = (m: {
    replyId: string | null;
    reply?: { content: string };
  }) => {
    if (!m.replyId) return null;
    const q = byId.get(m.replyId)?.content ?? m.reply?.content;
    return q === undefined ? null : quoteText(q);
  };
  let newest: string | null = null;
  for (const m of server) if (m.isSender) newest = m.id;

  const items: ThreadItem[] = [];
  let lastDay = '';
  const day = (at: string) => {
    const k = dayKey(at);
    if (k === lastDay) return;
    lastDay = k;
    items.push({
      kind: 'day',
      key: `day-${k}`,
      label: dayDiff(at, now) === 0 ? t.ruang.hariIni : dLong(at),
    });
  };
  for (const m of server) {
    day(m.createdAt);
    items.push({
      kind: 'message',
      key: m.id,
      id: m.id,
      mine: m.isSender === true,
      text: m.content,
      at: m.createdAt,
      quote: quoteOf(m),
      delivery: 'delivered',
      newestDelivered: m.id === newest,
    });
  }
  for (const e of outbox) {
    day(e.at);
    items.push({
      kind: 'message',
      key: e.localId,
      id: null,
      localId: e.localId,
      mine: true,
      text: e.text,
      at: e.at,
      quote: quoteOf({ replyId: e.replyId }),
      delivery: e.status,
      newestDelivered: false,
    });
  }
  return items;
}

/** Only a delivered message can be replied to (Balas); a failed one offers Kirim ulang instead. */
export const canReply = (m: ThreadMessage) => m.delivery === 'delivered';

/* ================= The composer ================= */

/**
 * What Enter does in the composer (SPEC story 98): on a touch keyboard (coarse pointer) it starts a new line and only
 * the button sends; with a fine pointer Enter sends and Shift+Enter starts a new line. Enter while an input method is
 * composing a word is the IME's.
 */
export function enterAction(e: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  coarse: boolean;
}): 'send' | 'newline' | 'none' {
  if (e.key !== 'Enter' || e.isComposing) return 'none';
  if (e.coarse || e.shiftKey) return 'newline';
  return 'send';
}

/* ================= Unread ================= */

export interface UnreadRow {
  chatroomId: string;
  unreadCount: number;
}

/** Unread Welfare messages per room (`GET /curhat/chatrooms/unread`; rooms without any are left out). */
export function unreadByRoom(
  rows: UnreadRow[] | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows ?? [])
    if (r.unreadCount > 0) out[r.chatroomId] = r.unreadCount;
  return out;
}

export function totalUnread(rows: UnreadRow[] | undefined): number {
  return (rows ?? []).reduce((n, r) => n + Math.max(0, r.unreadCount), 0);
}

/** One more unread message in a room (a Welfare reply arrived while the room wasn't open). */
export function addUnread(
  rows: UnreadRow[] | undefined,
  chatroomId: string,
): UnreadRow[] {
  const list = rows ?? [];
  return list.some((r) => r.chatroomId === chatroomId)
    ? list.map((r) =>
        r.chatroomId === chatroomId
          ? { ...r, unreadCount: r.unreadCount + 1 }
          : r,
      )
    : [...list, { chatroomId, unreadCount: 1 }];
}

/** The room was read: its count goes. */
export function clearUnread(
  rows: UnreadRow[] | undefined,
  chatroomId: string,
): UnreadRow[] {
  return (rows ?? []).filter((r) => r.chatroomId !== chatroomId);
}

/** The screen-reader text after a room's name: ", 1 pesan baru"; nothing at 0. */
export function unreadSr(n: number): string {
  return n > 0 ? fill(t.daftar.pesanBaru, { jumlah: n }) : '';
}
