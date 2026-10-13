/**
 * Beranda's rules (P1-A brief, rules 4–7): what needs following up and in which order, which Welfare replies count,
 * which form the Kelola summary shows, and the unread list. Pure, so `tests/beranda-rules.test.ts` checks them.
 * The prototype's versions: `attentionItems`, `roomUnread` (garis/state.js), `kelolaSummary`, `scrBeranda`
 * (garis/screens-core.js).
 */
import type {
  AdminFormListItem,
  FormListItem,
  Info,
  ListChatroom,
} from '~/api/generated';
import { dayDiff } from '~/lib/dates';
import { isPoint, type CalEvent } from '~/features/kalender/rules';

/** One Welfare room with a new reply: its id and when Welfare last replied. Never the message itself. */
export interface WelfareRoom {
  id: string;
  latestReply: string;
}

export type AttentionItem =
  | { kind: 'deadline'; event: CalEvent }
  | { kind: 'curhat'; rooms: WelfareRoom[] }
  | { kind: 'form'; form: FormListItem }
  | { kind: 'courses' }
  | { kind: 'push' };

/**
 * Rooms with a new reply from Welfare (rule 5): only rooms you own (`canDelete`; a Welfare member's list holds
 * everyone's rooms), only messages Welfare sent (`isSender: false`), only rooms the unread count names. Latest
 * reply first. Built against P2-C's fixed read state: the API's count is then per room and excludes read messages.
 */
export function welfareRooms(
  rooms: ListChatroom | undefined,
  unread:
    ReadonlyArray<{ chatroomId: string; unreadCount: number }> | undefined,
): WelfareRoom[] {
  if (!rooms || !unread) return [];
  const out: WelfareRoom[] = [];
  for (const { chatroomId, unreadCount } of unread) {
    const room = rooms[chatroomId];
    if (!room || room.canDelete !== true || unreadCount <= 0) continue;
    const replies = (room.messages ?? []).filter((m) => m.isSender === false);
    if (!replies.length) continue;
    const latest = replies.reduce((a, b) =>
      Date.parse(b.createdAt) > Date.parse(a.createdAt) ? b : a,
    );
    out.push({ id: room.id, latestReply: latest.createdAt });
  }
  return out.sort(
    (a, b) => Date.parse(b.latestReply) - Date.parse(a.latestReply),
  );
}

export interface AttentionInput {
  now: number;
  /** Events of the days around today; only deadlines still ahead today or tomorrow count. */
  events: readonly CalEvent[];
  welfare: readonly WelfareRoom[];
  /** Forms for your angkatan (`GET /form`); undefined while unknown. */
  forms: readonly FormListItem[] | undefined;
  /** This semester's courses; undefined while unknown (no "Atur mata kuliah" row until they are known). */
  courses: readonly unknown[] | undefined;
  /** Notifications are off on this device (known, not loading). */
  pushOff: boolean;
}

/** Perlu ditindaklanjuti (rule 4), in this order, only from these signals; a row goes with its signal (rule 6). */
export function attentionItems(input: AttentionInput): AttentionItem[] {
  const { now } = input;
  const items: AttentionItem[] = [];
  input.events
    .filter(
      (e) =>
        isPoint(e) && Date.parse(e.start) > now && dayDiff(e.start, now) <= 1,
    )
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .forEach((event) => items.push({ kind: 'deadline', event }));
  if (input.welfare.length)
    items.push({ kind: 'curhat', rooms: [...input.welfare] });
  for (const form of input.forms ?? [])
    if (form.status === 'open') items.push({ kind: 'form', form });
  if (input.courses && input.courses.length === 0)
    items.push({ kind: 'courses' });
  if (input.pushOff) items.push({ kind: 'push' });
  return items;
}

/**
 * The Kelola summary's form (rule 7): the first active form that has opened and hasn't closed, in the admin list's
 * order. Null hides the section.
 */
export function kelolaForm(
  forms: readonly AdminFormListItem[] | undefined,
  now: number,
): AdminFormListItem | null {
  return (
    forms?.find(
      (f) =>
        f.isActive &&
        Date.parse(f.opensAt) <= now &&
        (f.closesAt === null || Date.parse(f.closesAt) > now),
    ) ?? null
  );
}

/** Pengumuman belum dibaca: the three newest unread posts. */
export function unreadTop(infos: readonly Info[] | undefined): Info[] {
  return (infos ?? [])
    .filter((i) => i.isRead !== true)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3);
}

/** A post's line on Beranda: its title, or its text when it has none. */
export const postTitle = (i: Info) => i.title || i.content;
