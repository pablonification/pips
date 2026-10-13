/**
 * The Welfare inbox's rules (P3-C), pure so tests/curhat-inbox-rules.test.ts checks them without a browser: who sees
 * it, the order (pinned first, then newest message first, empty rooms last), the search and the Belum dibaca toggle,
 * whose message is whose (`fromOwner` decides the side, `isSender` decides "Kamu"), and what a failed write says.
 * The member side's rules (`features/curhat/rules.ts`) do the rest: names, initials, times, the thread.
 */
import type { Chatroom, ChatroomMessage } from '~/api/generated';
import { curhat as c } from '~/copy/curhat';
import { fill } from '~/copy/fill';
import { kelolaCurhat as t } from '~/copy/kelola-curhat';
import { can } from '~/lib/capabilities';
import { hm } from '~/lib/dates';
import {
  lastMessage,
  roomName,
  sortRooms,
  type OutboxEntry,
  type ThreadMessage,
} from '~/features/curhat/rules';

type WithRoles = Parameters<typeof can>[0];

/** The inbox, its Kelola row and the pin are Welfare's (`curhatadmin`, through the capability map) only. */
export const mayAnswerCurhat = (user: WithRoles) => can(user, 'respondCurhat');

/* ================= Whose message ================= */

/**
 * Who wrote a message, as Welfare sees it: you, a teammate, or the room's member. The side comes from `fromOwner`
 * (the member's on the left, Welfare's in gold on the right); "Kamu" from `isSender`.
 */
export type Speaker = 'kamu' | 'welfare' | 'anggota';

export function speakerOf(m: {
  isSender?: boolean;
  mine?: boolean;
  fromOwner?: boolean;
}): Speaker {
  if (m.isSender === true || m.mine === true) return 'kamu';
  return m.fromOwner ? 'anggota' : 'welfare';
}

/** Welfare's side (gold, right) unless the room's member wrote it. */
export const onWelfareSide = (m: { fromOwner?: boolean }) => !m.fromOwner;

/** The list's second line: "Kamu: …", "Welfare: …", "Anggota: …", or "Belum ada pesan". */
export function inboxPreview(room: Chatroom): string {
  const last = lastMessage(room);
  if (!last) return c.daftar.belumAdaPesan;
  const who = speakerOf(last);
  return fill(c.daftar.pratinjau, {
    siapa:
      who === 'kamu'
        ? c.daftar.kamu
        : who === 'welfare'
          ? c.daftar.welfare
          : t.daftar.anggota,
    pesan: last.content,
  });
}

/** A bubble's time line: "10.12" for yours, "Welfare · 10.12" for a teammate's, "Teal Koala · 10.12" for the member's. */
export function inboxTimeLine(m: ThreadMessage, room: string): string {
  const jam = hm(m.at);
  const who = speakerOf(m);
  if (who === 'kamu') return jam;
  if (who === 'welfare') return fill(c.ruang.waktuWelfare, { jam });
  return fill(t.ruang.waktuAnggota, { nama: room, jam });
}

/** What a screen reader hears before a message: "Kamu: ", "Welfare: ", "Teal Koala: ". */
export function inboxSpeakerSr(m: ThreadMessage, room: string): string {
  const who = speakerOf(m);
  if (who === 'kamu') return c.ruang.kamuSr;
  if (who === 'welfare') return c.ruang.welfareSr;
  return fill(t.ruang.anggotaSr, { nama: room });
}

/* ================= The list ================= */

export interface InboxFilter {
  /** The search, as typed (trimmed here). */
  q?: string;
  /** Belum dibaca: only rooms with unread messages. */
  unread?: boolean;
}

const fold = (s: string) => s.toLocaleLowerCase('id');

/** The room's name (as shown, or as stored) or any of its messages holds the search; an empty search holds always. */
export function matchesSearch(room: Chatroom, q: string | undefined): boolean {
  const needle = fold((q ?? '').trim());
  if (!needle) return true;
  if (fold(roomName(room.title)).includes(needle)) return true;
  return (room.messages ?? []).some((m: ChatroomMessage) =>
    fold(m.content).includes(needle),
  );
}

export type InboxEmpty = 'none' | 'noMatch' | 'allRead';

export interface InboxView {
  /** Pinned rooms, newest message first. */
  pinned: Chatroom[];
  /** The rest, newest message first, rooms without messages last. */
  rest: Chatroom[];
  /** Why nothing shows: no rooms at all, none matches the search, or Belum dibaca with nothing unread. */
  empty: InboxEmpty | null;
}

/** The inbox as it shows: the search and the toggle together, pinned rooms first, each part in today's order. */
export function inboxView(
  rooms: Chatroom[],
  filter: InboxFilter,
  unreadByRoom: Record<string, number>,
): InboxView {
  const shown = rooms.filter(
    (r) =>
      matchesSearch(r, filter.q) &&
      (!filter.unread || (unreadByRoom[r.id] ?? 0) > 0),
  );
  const pinned = sortRooms(shown.filter((r) => r.isPinned === true));
  const rest = sortRooms(shown.filter((r) => r.isPinned !== true));
  let empty: InboxEmpty | null = null;
  if (!rooms.length) empty = 'none';
  else if (!shown.length)
    empty = (filter.q ?? '').trim() ? 'noMatch' : 'allRead';
  return { pinned, rest, empty };
}

/* ================= Writes ================= */

/**
 * What a failed write says: 401 or 403 is "no access" (the API answers a missing role with 401; P0-B's session check
 * is the only thing that signs anyone out), anything else the general line. Never "signed out".
 */
export function writeFailure(status: number | undefined): 'ditolak' | 'gagal' {
  return status === 401 || status === 403 ? 'ditolak' : 'gagal';
}

/* ================= Sending ================= */

/** The reply that didn't go through: what it said, what it quoted, and its outbox entry (for the same device id). */
export interface FailedReply {
  localId: string;
  text: string;
  replyId: string | null;
}

/**
 * Sending what's in the composer: the same text and quote as the reply that failed go again with its device id
 * (`CurhatClient.retry`), so a reply saved whose acknowledgement was lost is saved once (OPEN-QUESTIONS A11);
 * anything changed is a new message.
 */
export function sendPlan(
  failed: FailedReply | null,
  text: string,
  replyId: string | null,
  outbox: readonly Pick<OutboxEntry, 'localId' | 'status'>[],
): { kind: 'retry'; localId: string } | { kind: 'send' } {
  if (
    failed &&
    failed.text === text &&
    failed.replyId === replyId &&
    outbox.some((e) => e.localId === failed.localId && e.status === 'failed')
  )
    return { kind: 'retry', localId: failed.localId };
  return { kind: 'send' };
}

/**
 * The inbox draws only what the server saved (SPEC's corrections: no delivery states for Welfare): delivered
 * outbox entries, never Mengirim or Gagal.
 */
export const deliveredOnly = (outbox: readonly OutboxEntry[]) =>
  outbox.filter((e) => e.status === 'delivered');
