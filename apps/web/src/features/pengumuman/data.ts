/**
 * Pengumuman's reads and writes. Query keys stay in `src/api/constants.ts` (today's `INFO_LIST_QUERY_KEY` and
 * `INFO_QUERY_KEY`), so P1-A's Beranda list and search refresh after these writes. Writes that change what the
 * member sees (read state, reactions) update every cached copy at once and roll back if the server refuses.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '~/api/client';
import {
  ANGKATAN_QUERY_KEY,
  CATEGORIES_QUERY_KEY,
  INFO_LIST_QUERY_KEY,
  INFO_QUERY_KEY,
} from '~/api/constants';
import {
  ApiError,
  type CommentWithReactions,
  type Info,
  type ReactionAggregate,
} from '~/api/generated';
import {
  infoCommentsQuery,
  infoDetailQuery,
  unreadInfosQuery,
} from '~/api/queries';
import type { PixelReactionKey } from '~/components/garis/pixel-art';
import {
  applyReaction,
  feedKey,
  feedRequest,
  nextOffset,
  withReadState,
  type FeedView,
} from './rules';
import { UNREAD_KEY } from './unread';
import { keepUnsent } from '~/lib/unsent-text';

export const statusOf = (e: unknown) =>
  e instanceof ApiError ? e.status : undefined;

/* ================= Reads ================= */

type Feed = InfiniteData<Info[], number>;

export function useFeed(view: FeedView) {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: feedKey(INFO_LIST_QUERY_KEY, view),
    queryFn: ({ pageParam }) =>
      api.info.getListInfo(feedRequest(view, pageParam)).then(({ infos }) => {
        // Opening a post from the list shows it at once.
        for (const info of infos)
          qc.setQueryData(infoDetailQuery(info.id).queryKey, info);
        return infos;
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => nextOffset(last, pages.length),
    // Stale data stays on screen while a refetch runs (SPEC "States").
    placeholderData: (prev) => prev,
  });
}

export const useInfo = (id: string) =>
  useQuery({
    ...infoDetailQuery(id),
    retry: (n, e) => statusOf(e) !== 404 && n < 2,
  });

export const useComments = (id: string, enabled = true) =>
  useQuery({ ...infoCommentsQuery(id), enabled });

/** Every category, for the filter (`GET /api/category`); today's key. */
export const useCategories = () =>
  useQuery({
    queryKey: [CATEGORIES_QUERY_KEY],
    queryFn: () => api.category.getListCategory(),
    select: (d) => d.categories,
  });

/** The categories this member may post in (`GET /api/category/info`); today's key. */
export const usePostableCategories = () =>
  useQuery({
    queryKey: [CATEGORIES_QUERY_KEY, 'info'],
    queryFn: () => api.category.getInfoListCategory(),
    select: (d) => d.categories,
  });

export const useAngkatan = () =>
  useQuery({
    queryKey: [ANGKATAN_QUERY_KEY],
    queryFn: () => api.category.getListAngkatan(),
    staleTime: Infinity,
  });

/** Your groups with their names (`GET /api/auth/groups`); today's key. */
export const useGroups = () =>
  useQuery({
    queryKey: ['user-groups'],
    queryFn: () => api.auth.getUserGroups(),
  });

/* ================= Cache updates ================= */

/** Change one post wherever it is cached: every feed page and its detail. */
export function patchInfo(qc: QueryClient, id: string, fn: (i: Info) => Info) {
  qc.setQueriesData<Feed>({ queryKey: [INFO_LIST_QUERY_KEY] }, (data) =>
    data && Array.isArray(data.pages)
      ? {
          ...data,
          pages: data.pages.map((p) => p.map((i) => (i.id === id ? fn(i) : i))),
        }
      : data,
  );
  qc.setQueryData<Info>(infoDetailQuery(id).queryKey, (i) => (i ? fn(i) : i));
}

/** Take a deleted post out of every feed, the count and its detail. */
export function dropInfo(qc: QueryClient, id: string) {
  qc.setQueriesData<Feed>({ queryKey: [INFO_LIST_QUERY_KEY] }, (data) =>
    data && Array.isArray(data.pages)
      ? { ...data, pages: data.pages.map((p) => p.filter((i) => i.id !== id)) }
      : data,
  );
  qc.setQueryData<string[]>(UNREAD_KEY, (ids) => ids?.filter((x) => x !== id));
  qc.removeQueries({ queryKey: infoDetailQuery(id).queryKey });
}

type Snapshot = Array<[readonly unknown[], unknown]>;
function snapshot(qc: QueryClient, id: string): Snapshot {
  return [
    ...qc.getQueriesData({ queryKey: [INFO_LIST_QUERY_KEY] }),
    [
      infoDetailQuery(id).queryKey,
      qc.getQueryData(infoDetailQuery(id).queryKey),
    ],
    [
      infoCommentsQuery(id).queryKey,
      qc.getQueryData(infoCommentsQuery(id).queryKey),
    ],
  ];
}
const restore = (qc: QueryClient, snap: Snapshot) => {
  for (const [key, data] of snap) qc.setQueryData(key, data);
};

/* ================= Writes ================= */

/** Mark a post read or unread: the list, the post and the count change at once. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      api.info.readInfo({ infoId: id, requestBody: { unread: !read } }),
    onMutate: async ({ id, read }) => {
      const snap = snapshot(qc, id);
      snap.push([UNREAD_KEY, qc.getQueryData(UNREAD_KEY)]);
      patchInfo(qc, id, (i) => ({ ...i, isRead: read }));
      qc.setQueryData<string[]>(UNREAD_KEY, (ids) =>
        ids ? withReadState(ids, id, read) : ids,
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => ctx && restore(qc, ctx.snap),
  });
}

/**
 * Tandai semua dibaca (owner, 2026-11-06): the server marks the member's whole feed read; then the count, the badge,
 * Beranda's list and every cached post say so at once, and the lists reload from the server.
 */
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.info.readAllInfo(),
    onSuccess: async () => {
      const read = (i: Info) => (i.isRead ? i : { ...i, isRead: true });
      qc.setQueryData<string[]>(UNREAD_KEY, []);
      qc.setQueryData<Info[]>(unreadInfosQuery().queryKey, []);
      qc.setQueriesData<Feed>({ queryKey: [INFO_LIST_QUERY_KEY] }, (data) =>
        data && Array.isArray(data.pages)
          ? { ...data, pages: data.pages.map((p) => p.map(read)) }
          : data,
      );
      qc.setQueriesData<Info>({ queryKey: [INFO_QUERY_KEY, 'detail'] }, (i) =>
        i ? read(i) : i,
      );
      await qc.invalidateQueries({ queryKey: [INFO_LIST_QUERY_KEY] });
    },
  });
}

export type ReactTarget =
  | { kind: 'info'; infoId: string }
  | { kind: 'comment'; infoId: string; commentId: string };

/** React, change or remove your reaction (one per person); optimistic, rolled back on failure. */
export function useReact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      target,
      next,
    }: {
      target: ReactTarget;
      next: PixelReactionKey | null;
    }) => {
      if (next)
        return api.reaction.createOrUpdateReaction({
          requestBody:
            target.kind === 'info'
              ? { infoId: target.infoId, reaction: next }
              : { commentId: target.commentId, reaction: next },
        });
      return target.kind === 'info'
        ? api.reaction.deleteInfoReaction({ infoId: target.infoId })
        : api.reaction.deleteCommentReaction({ commentId: target.commentId });
    },
    onMutate: async ({ target, next }) => {
      const snap = snapshot(qc, target.infoId);
      const bump = (r: ReactionAggregate) => applyReaction(r, next);
      if (target.kind === 'info')
        patchInfo(qc, target.infoId, (i) => ({
          ...i,
          reactions: bump(i.reactions),
        }));
      else
        qc.setQueryData<CommentWithReactions[]>(
          infoCommentsQuery(target.infoId).queryKey,
          (list) =>
            list?.map((c) =>
              c.id === target.commentId
                ? { ...c, reactions: bump(c.reactions) }
                : c,
            ),
        );
      return { snap };
    },
    onError: (_e, _v, ctx) => ctx && restore(qc, ctx.snap),
  });
}

/** One key per post, so a comment box can tell that a send for its post is still out. */
export const postCommentKey = (infoId: string) => ['postComment', infoId];

export function usePostComment(infoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: postCommentKey(infoId),
    mutationFn: (content: string) =>
      api.comment.postComment({
        requestBody: { repliedInfoId: infoId, content },
      }),
    // Offline, a send fails at once (the comment's error with Coba lagi) instead of waiting, paused, and going out
    // later by itself.
    networkMode: 'always',
    onSuccess: (created) => {
      // Sent: its kept text goes, even when the member has opened another post meanwhile.
      keepUnsent(`komentar:${infoId}`, '');
      qc.setQueryData<CommentWithReactions[]>(
        infoCommentsQuery(infoId).queryKey,
        (list) => [
          ...(list ?? []),
          { ...created, reactions: { totalReactions: 0, reactionsCount: [] } },
        ],
      );
      patchInfo(qc, infoId, (i) => ({ ...i, comments: i.comments + 1 }));
    },
  });
}

export function useDeleteComment(infoId: string) {
  const qc = useQueryClient();
  const drop = (commentId: string) => {
    qc.setQueryData<CommentWithReactions[]>(
      infoCommentsQuery(infoId).queryKey,
      (list) => list?.filter((c) => c.id !== commentId),
    );
    patchInfo(qc, infoId, (i) => ({
      ...i,
      comments: Math.max(0, i.comments - 1),
    }));
  };
  return useMutation({
    mutationFn: (commentId: string) =>
      api.comment.deleteComment({ commentId }).catch((e: unknown) => {
        // Already gone: take it out all the same.
        if (statusOf(e) === 404) return null;
        throw e;
      }),
    onSuccess: (_r, commentId) => drop(commentId),
  });
}

export function useDeleteInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.info.deleteInfo({ infoId: id }).catch((e: unknown) => {
        if (statusOf(e) === 404) return null;
        throw e;
      }),
    onSuccess: (_r, id) => {
      dropInfo(qc, id);
      void qc.invalidateQueries({ queryKey: [INFO_LIST_QUERY_KEY] });
    },
  });
}

export function useRenotify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.info.renotifyInfo({ infoId: id }),
    onSuccess: (_r, id) =>
      patchInfo(qc, id, (i) => ({
        ...i,
        lastNotifiedAt: new Date().toISOString(),
        canNotify: false,
      })),
    // Locked after all (the server's 400): its truth replaces ours.
    onError: (_e, id) =>
      void qc.invalidateQueries({ queryKey: infoDetailQuery(id).queryKey }),
  });
}

export function useCreateInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: Parameters<typeof api.info.createInfo>[0]['requestBody'],
    ) => {
      const created = await api.info.createInfo({ requestBody: body });
      // The API doesn't mark a new post read for its author.
      await api.info
        .readInfo({ infoId: created.id, requestBody: { unread: false } })
        .catch(() => undefined);
      return created;
    },
    // As a comment's: offline fails at once, and nothing is published later without a tap.
    networkMode: 'always',
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [INFO_LIST_QUERY_KEY] });
    },
  });
}

/** A photo's upload (shared with Info Lomba's poster). */
export { uploadImage as uploadPhoto } from '~/lib/upload';
