/**
 * Pengumuman's rules, pure so `tests/pengumuman-rules.test.ts` checks each one (the brief's "Rules to unit-test").
 * The prototype's versions are in garis/state.js (`feedPosts`, `audText`, `rTop`, `canRenotify`, `notifyLine`) and
 * the `compose` submit handler in garis/app.js; the server's in apps/api (`info.repo.ts`, `lib/renotify.ts`).
 *
 * Visibility is the server's: nothing here filters posts by angkatan or group.
 */
import type {
  Angkatan,
  Category,
  Info,
  ReactionAggregate,
  UserGroup,
} from '~/api/generated';
import {
  PIXEL_REACTION_KEYS,
  PIXEL_REACTION_LABELS,
  type PixelReactionKey,
} from '~/components/garis/pixel-art';
import { fill } from '~/copy/fill';
import { pengumuman as t } from '~/copy/pengumuman';
import { canDeleteContent } from '~/lib/capabilities';
import {
  MAX_INFO_ANNOUNCEMENT_LENGTH,
  MAX_INFO_TITLE_LENGTH,
} from '~/lib/constants';
import { hm } from '~/lib/dates';

export const PAGE_SIZE = 10;
/** Paging loads by itself up to this many pages; after that only Muat lagi does (SPEC "Pengumuman"). */
export const AUTO_PAGES = 5;
/** Umumkan ulang opens again this many hours after the last notification (apps/api `RENOTIFY_DIFF_HOURS`). */
export const RENOTIFY_HOURS = 3;
export const MAX_TITLE = MAX_INFO_TITLE_LENGTH;
export const MAX_BODY = MAX_INFO_ANNOUNCEMENT_LENGTH;

/* ================= The feed's view (the URL's search params) ================= */

export type Sort = 'newest' | 'oldest';

/** The feed's view, as P0-B's `pengumumanSearchSchema` reads it from the URL (today's names). */
export interface FeedView {
  search?: string;
  unread?: boolean;
  /** Hidden categories, by **name** (the API's `excludeCategory` takes names). */
  excludeCategories?: string[];
  sort?: string;
}

/**
 * The view in its one canonical form: the default view is all `undefined`, which is also the query key the
 * device keeps for offline use (api/persistence-policy.ts keeps the feed "with no search, filter or sort").
 */
export interface CanonicalView {
  search: string | undefined;
  unread: true | undefined;
  excludeCategories: string[] | undefined;
  sort: 'oldest' | undefined;
}

export function canonicalView(view: FeedView): CanonicalView {
  const search = view.search?.trim() ? view.search : undefined;
  const hidden = [...new Set(view.excludeCategories ?? [])].sort();
  return {
    search,
    unread: view.unread ? true : undefined,
    excludeCategories: hidden.length ? hidden : undefined,
    sort: view.sort === 'oldest' ? 'oldest' : undefined,
  };
}

export const isDefaultView = (view: FeedView) =>
  Object.values(canonicalView(view)).every((v) => v === undefined);

/** The feed's query key (today's `INFO_LIST_QUERY_KEY` with the view), shared with P1-A's Beranda and search. */
export function feedKey(listKey: string, view: FeedView) {
  const v = canonicalView(view);
  return [listKey, v.search, v.unread, v.excludeCategories, v.sort] as const;
}

/** `GET /api/info` for one page of the view. */
export function feedRequest(view: FeedView, offset: number) {
  const v = canonicalView(view);
  return {
    search: v.search?.trim(),
    unread: v.unread ? ('true' as const) : ('false' as const),
    excludeCategory: v.excludeCategories,
    offset,
    sort: (v.sort ?? 'newest') as Sort,
  };
}

/** The next page's offset, or undefined at the end (a page shorter than 10). */
export function nextOffset(lastPage: readonly unknown[], pages: number) {
  return lastPage.length < PAGE_SIZE ? undefined : pages * PAGE_SIZE;
}

/**
 * The filter hides a post when **any** of its categories is hidden (the API's `excludeCategory`), by name. Used to
 * keep the list right at once after a switch, before the server answers.
 */
export function hiddenByFilter(info: Info, hidden: readonly string[]) {
  return (info.infoCategories ?? []).some((c) =>
    hidden.includes(c.category.name),
  );
}

/** Toggle one category's visibility, by name. */
export function toggleHidden(hidden: readonly string[], name: string) {
  return hidden.includes(name)
    ? hidden.filter((n) => n !== name)
    : [...hidden, name];
}

/**
 * Why the list is empty (`feedList`): the search first, then unread only, then the hidden categories. Null when
 * nothing narrows the list (there are no posts at all): then there's no reason to give and nothing to reset.
 */
export function emptyReason(view: FeedView): string | null {
  const v = canonicalView(view);
  if (v.search) return fill(t.feed.kosongCari, { kata: v.search.trim() });
  if (v.unread) return t.feed.kosongBelumDibaca;
  if (v.excludeCategories) return t.feed.kosongKategori;
  return null;
}

/* ================= The unread count ================= */

/** Open question 2: no count endpoint, so the count pages `GET /api/info?unread=true` in the background. */
export const UNREAD_PAGES = 10;
export const UNREAD_SHOWN_MAX = 99;

/** The count as the badges and the chip show it: hidden at 0, "99+" past the cap. */
export function unreadLabel(n: number) {
  if (n <= 0) return null;
  return n > UNREAD_SHOWN_MAX ? t.feed.banyak : String(n);
}

/**
 * Pages the unread ids: `fetchPage(offset)` until a short page or `UNREAD_PAGES` pages. The count ignores the
 * feed's search and filter (`unreadN` counts every visible unread post).
 */
export async function pageUnreadIds(
  fetchPage: (offset: number) => Promise<Pick<Info, 'id'>[]>,
) {
  const ids: string[] = [];
  for (let page = 0; page < UNREAD_PAGES; page++) {
    const infos = await fetchPage(page * PAGE_SIZE);
    for (const i of infos) if (!ids.includes(i.id)) ids.push(i.id);
    if (infos.length < PAGE_SIZE) break;
  }
  return ids;
}

/** The unread ids after marking one read or unread. */
export function withReadState(
  ids: readonly string[],
  id: string,
  read: boolean,
) {
  if (read) return ids.filter((x) => x !== id);
  return ids.includes(id) ? [...ids] : [id, ...ids];
}

/* ================= Reactions (one per person) ================= */

export const REACTION_KEYS = PIXEL_REACTION_KEYS;
export const isReactionKey = (k: unknown): k is PixelReactionKey =>
  typeof k === 'string' && (REACTION_KEYS as string[]).includes(k);
export const reactionLabel = (k: PixelReactionKey) => PIXEL_REACTION_LABELS[k];

/** The counts of the six known reactions, in the app's order; keys outside the six are ignored. */
export function reactionCounts(agg: ReactionAggregate) {
  return REACTION_KEYS.map((k) => ({
    key: k,
    count: agg.reactionsCount.find((r) => r.reaction === k)?.count ?? 0,
  }));
}

/** This member's reaction, if it is one of the six. */
export const myReaction = (agg: ReactionAggregate) =>
  isReactionKey(agg.userReaction) ? agg.userReaction : null;

export const reactionTotal = (agg: ReactionAggregate) =>
  reactionCounts(agg).reduce((n, r) => n + r.count, 0);

/** The three most given (ties keep the app's order), as the feed's stacked summary (`rTop`). */
export function topReactions(agg: ReactionAggregate, n = 3) {
  return reactionCounts(agg)
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((r) => r.key);
}

/** What picking `key` does: set it, replace yours, or (yours again) remove it. */
export function nextReaction(
  agg: ReactionAggregate,
  key: PixelReactionKey,
): PixelReactionKey | null {
  return myReaction(agg) === key ? null : key;
}

/** The aggregate after this member's reaction becomes `next` (optimistic update). */
export function applyReaction(
  agg: ReactionAggregate,
  next: PixelReactionKey | null,
): ReactionAggregate {
  const counts = new Map(agg.reactionsCount.map((r) => [r.reaction, r.count]));
  if (agg.userReaction)
    counts.set(
      agg.userReaction,
      Math.max(0, (counts.get(agg.userReaction) ?? 1) - 1),
    );
  if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
  const reactionsCount = [...counts]
    .filter(([, c]) => c > 0)
    .map(([reaction, count]) => ({ reaction, count }));
  const out: ReactionAggregate = {
    totalReactions: reactionsCount.reduce((n, r) => n + r.count, 0),
    reactionsCount,
  };
  if (next) out.userReaction = next;
  return out;
}

/** The feed's reaction button's name (`reactSummaryBtn`). */
export function summaryLabel(agg: ReactionAggregate) {
  const mine = myReaction(agg);
  const total = reactionTotal(agg);
  return mine
    ? fill(t.reaksi.ringkasMilikmu, { reaksi: reactionLabel(mine), total })
    : fill(t.reaksi.ringkas, { total });
}

/** A detail chip's name: "Keren, 3 orang, termasuk kamu". */
export function chipLabel(key: PixelReactionKey, count: number, mine: boolean) {
  return fill(mine ? t.reaksi.chipMilikmu : t.reaksi.chip, {
    reaksi: reactionLabel(key),
    jumlah: count,
  });
}

/* ================= Umumkan ulang ================= */

const ms = (d: Date | string | number) => new Date(d).getTime();

/** When Umumkan ulang opens again: `hours` after the last notification. */
export function renotifyAvailableAt(
  lastNotifiedAt: Date | string,
  hours = RENOTIFY_HOURS,
) {
  return new Date(ms(lastNotifiedAt) + hours * 36e5);
}

/**
 * Whether the author may re-announce now: once `hours` have passed, against the current time, so an open screen
 * unlocks without a refetch.
 */
export function canRenotify(
  info: Pick<Info, 'lastNotifiedAt'>,
  now: Date | number,
  hours = RENOTIFY_HOURS,
) {
  return ms(now) >= renotifyAvailableAt(info.lastNotifiedAt, hours).getTime();
}

/** What a failed `POST …/renotify` means: the server's 400 is "still locked"; 403 not yours; else a failure. */
export function renotifyFailure(status: number | undefined) {
  if (status === 400) return 'locked' as const;
  if (status === 403) return 'denied' as const;
  return 'failed' as const;
}

/** "Bisa lagi mulai 15.30". */
export const renotifyHint = (info: Pick<Info, 'lastNotifiedAt'>) =>
  fill(t.menu.bisaLagi, { jam: hm(renotifyAvailableAt(info.lastNotifiedAt)) });

/* ================= The menu ================= */

type Me = { id: string; roles?: readonly string[] | null } | null | undefined;

export interface MenuModel {
  /** "Tandai sudah dibaca" or "Tandai belum dibaca": everyone. */
  mark: 'read' | 'unread';
  /** Umumkan ulang: the author only. */
  renotify: boolean;
  /** Hapus pengumuman: the author or `admin` ("Sebagai admin" when not yours). */
  remove: null | 'own' | 'admin';
}

export function menuModel(
  info: Pick<Info, 'creatorId' | 'isRead'>,
  me: Me,
): MenuModel {
  const own = !!me && me.id === info.creatorId;
  return {
    mark: info.isRead ? 'unread' : 'read',
    renotify: own,
    remove: canDeleteContent(me, info.creatorId)
      ? own
        ? 'own'
        : 'admin'
      : null,
  };
}

/* ================= Audience ================= */

/** "2025 · PIXEL", or the year alone when the angkatan has no name (`angLabel`). */
export const angLabel = (a: Pick<Angkatan, 'year' | 'name'>) =>
  a.name ? `${a.year} · ${a.name}` : String(a.year);

/** The audience line: "Untuk angkatan 2025 · PIXEL", "Untuk grup Akademik", "Untuk semua anggota" (`audText`). */
export function audText(info: Pick<Info, 'infoAngkatan' | 'infoGroups'>) {
  const ang = info.infoAngkatan ?? [];
  const groups = info.infoGroups ?? [];
  if (ang.length)
    return fill(t.post.untukAngkatan, {
      daftar: ang.map((a) => angLabel(a.angkatan)).join(', '),
    });
  if (groups.length)
    return fill(t.post.untukGrup, {
      daftar: groups.map((g) => g.group).join(', '),
    });
  return t.post.untukSemua;
}

export const isForEveryone = (
  info: Pick<Info, 'infoAngkatan' | 'infoGroups'>,
) => !info.infoAngkatan?.length && !info.infoGroups?.length;

/** Whom the re-announcement reached, for its toast: "semua anggota", "angkatan 2025 · PIXEL". */
export const audienceWords = (
  info: Pick<Info, 'infoAngkatan' | 'infoGroups'>,
) => {
  const text = audText(info);
  return text.replace(/^Untuk /, '');
};

/* ================= Composer ================= */

export type AudienceKind = 'all' | 'angkatan' | 'group';

export interface Draft {
  title: string;
  body: string;
  /** Category ids. */
  cats: string[];
  audType: AudienceKind;
  /** Angkatan ids (`forAngkatan`) or roles (`forGroups`). */
  aud: string[];
  /** Photos' uploaded URLs, in order (only finished uploads). */
  mediaUrls: string[];
}

export const freshDraft = (): Draft => ({
  title: '',
  body: '',
  cats: [],
  audType: 'all',
  aud: [],
  mediaUrls: [],
});

export interface DraftErrors {
  body?: string;
  cats?: string;
  aud?: string;
}

/** The `compose` submit handler's checks, with its exact messages. */
export function validateDraft(d: Draft): DraftErrors {
  const err: DraftErrors = {};
  if (!d.body.trim()) err.body = t.tulis.errIsi;
  if (!d.cats.length) err.cats = t.tulis.errKategori;
  if (d.audType !== 'all' && !d.aud.length)
    err.aud = d.audType === 'angkatan' ? t.tulis.errAngkatan : t.tulis.errGrup;
  return err;
}

/** Where focus goes after a failed submit: the first error, in the form's order. */
export function firstError(err: DraftErrors): keyof DraftErrors | null {
  if (err.body) return 'body';
  if (err.cats) return 'cats';
  if (err.aud) return 'aud';
  return null;
}

/** `POST /api/info`'s body: trimmed text, category ids, one audience kind (never both, never courses), photos in order. */
export function composeBody(d: Draft) {
  const body: {
    title: string;
    content: string;
    forCategories: string[];
    forAngkatan?: string[];
    forGroups?: string[];
    mediaUrls?: string[];
  } = {
    title: d.title.trim(),
    content: d.body.trim(),
    forCategories: [...d.cats],
  };
  if (d.audType === 'angkatan') body.forAngkatan = [...d.aud];
  if (d.audType === 'group') body.forGroups = [...d.aud];
  if (d.mediaUrls.length) body.mediaUrls = [...d.mediaUrls];
  return body;
}

/** The audience choices: Grup-ku only for members with groups (`GET /api/auth/groups` not empty). */
export function audienceKinds(groups: readonly UserGroup[]): AudienceKind[] {
  return groups.length ? ['all', 'angkatan', 'group'] : ['all', 'angkatan'];
}

/**
 * Who gets the push, and who sees the post (`notifyLine`). The server skips members who muted **all** the post's
 * categories (apps/api `notifyNewInfo`), hence "kecuali yang mematikan kategori A dan B".
 */
export function notifyLine(
  d: Pick<Draft, 'audType' | 'aud' | 'cats'>,
  ctx: {
    categories: readonly Pick<Category, 'id' | 'name'>[];
    angkatan: readonly Pick<Angkatan, 'id' | 'year'>[];
    groups: readonly UserGroup[];
  },
) {
  let siapa: string;
  if (d.audType === 'angkatan')
    siapa = d.aud.length
      ? fill(t.tulis.keAngkatan, {
          daftar: d.aud
            .map((id) => ctx.angkatan.find((a) => a.id === id)?.year ?? id)
            .join(', '),
        })
      : t.tulis.keAngkatanKosong;
  else if (d.audType === 'group')
    siapa = d.aud.length
      ? fill(t.tulis.keGrup, {
          daftar: d.aud
            .map((r) => ctx.groups.find((g) => g.role === r)?.group ?? r)
            .join(', '),
        })
      : t.tulis.keGrupKosong;
  else siapa = t.tulis.keSemua;
  const kategori = d.cats.length
    ? d.cats
        .map((id) => ctx.categories.find((c) => c.id === id)?.name ?? id)
        .join(t.tulis.dan)
    : t.tulis.kategoriKosong;
  return (
    fill(t.tulis.notifikasi, { siapa, kategori }) +
    (d.audType === 'all' ? '' : t.tulis.hanyaMereka)
  );
}

/* ================= Photos ================= */

export type UploadState =
  | { status: 'uploading'; progress: number }
  | { status: 'done'; url: string }
  | { status: 'failed' };

/** Why Umumkan is blocked by the photos, or null when it isn't. */
export function uploadsBlock(uploads: readonly UploadState[]) {
  if (uploads.some((u) => u.status === 'uploading'))
    return t.tulis.menungguFoto;
  if (uploads.some((u) => u.status === 'failed')) return t.tulis.fotoGagal;
  return null;
}

export const uploadedUrls = (uploads: readonly UploadState[]) =>
  uploads.flatMap((u) => (u.status === 'done' ? [u.url] : []));

/* ================= Links ================= */

export type LinkKind = 'gform' | 'sheet' | 'web';

/** A link's card: Google Forms open inside PIPS!, Sheets get the sheet tile, others the link tile. */
export function linkKind(
  url: string,
  og?: { ogTitle?: string; ogDescription?: string; requestUrl?: string } | null,
): LinkKind {
  const u = url.toLowerCase();
  // Today's `isGoogleForm` (pengumuman/$id/-helper.tsx), plus forms.gle short links.
  const form =
    u.includes('docs.google.com/forms') ||
    u.includes('forms.gle/') ||
    og?.ogTitle?.toLowerCase().includes('google forms') ||
    og?.ogDescription?.toLowerCase().includes('google forms') ||
    og?.requestUrl?.toLowerCase().includes('docs.google.com/forms');
  if (form) return 'gform';
  if (u.includes('docs.google.com/spreadsheets')) return 'sheet';
  return 'web';
}

export const absoluteUrl = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

/** "docs.google.com" */
export function hostOf(url: string) {
  try {
    return new URL(absoluteUrl(url)).host;
  } catch {
    return url;
  }
}

/* ================= Text ================= */

/**
 * The post's text as shown: links left alone on its last lines are dropped, since their cards follow right below
 * (the prototype keeps a post's link apart from its text). Links inside the text stay, made links.
 */
export function displayText(content: string) {
  const lines = content.replace(/\s+$/, '').split('\n');
  const bare = /^\s*(?:https?:\/\/|www\.)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?\s*$/i;
  while (lines.length > 1 && bare.test(lines[lines.length - 1])) lines.pop();
  return lines.join('\n').replace(/\s+$/, '');
}

/** A post's name where it has no title: "Opsi untuk pengumuman Dimas Aditya", "Pengumuman dari Dimas Aditya". */
export const menuLabel = (info: Pick<Info, 'title' | 'creator'>) =>
  fill(t.post.menu, {
    judul:
      info.title ||
      fill(t.post.menuTanpaJudul, { nama: info.creator.fullName }),
  });

/** A comment's reaction button's name. */
export function commentReactLabel(mine: PixelReactionKey | null, name: string) {
  return mine
    ? fill(t.reaksi.komentarMilikmu, {
        reaksi: reactionLabel(mine),
        nama: name,
      })
    : fill(t.reaksi.komentar, { nama: name });
}
