/**
 * The Pengumuman routes. `/pengumuman` is a layout: on desktop it keeps the list on the left (its scroll and search
 * stay while posts change on the right); below 1024 px each route is its own page. The list and the pane keep their
 * places in the tree across 1024 px, so rotating a tablet keeps what was typed (P0-C review M2).
 */
import {
  Outlet,
  useMatch,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { useEffect, useMemo, useRef } from 'react';
import { ApiError } from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
  SkeletonRow,
} from '~/components/garis';
import { DESKTOP_QUERY, useMediaQuery } from '~/components/garis/useMediaQuery';
import { keepFocusOnNavigationTo } from '~/components/shell/focus';
import { PageBody, PageTitle } from '~/components/shell/page';
import { pengumuman as t } from '~/copy/pengumuman';
import { useFeed, useInfo, useMarkRead } from './data';
import { FeedPanel } from './FeedPanel';
import { useDelayed } from './parts';
import { PostDetail } from './PostDetail';
import { ComposeDialog, ComposePage } from './Composer';
import { canonicalView, hiddenByFilter, type FeedView } from './rules';
import { focusSoon, takeWantComment, useFeedView } from './view';
import './pengumuman.css';

const POST_ROUTE = '/_app/_left-navbar/pengumuman/$id/' as const;

/** The first post the view shows: desktop's default selection (not marked read). */
function useFirstVisible(view: FeedView) {
  const feed = useFeed(view);
  return feed.data?.pages[0]?.[0]?.id ?? null;
}

export function PengumumanLayout() {
  const desk = useMediaQuery(DESKTOP_QUERY);
  const view = useFeedView();
  const post = useMatch({ from: POST_ROUTE, shouldThrow: false });
  const index = useMatch({
    from: '/_app/_left-navbar/pengumuman/',
    shouldThrow: false,
  });
  const first = useFirstVisible(view);
  const selected = post ? post.params.id : first;
  const list = desk || !!index;
  return (
    <div className={desk ? 'g-split' : 'contents'}>
      {list ? (
        <div className={desk ? 'l' : 'contents'}>
          <ListColumn desk={desk} selected={selected} />
        </div>
      ) : null}
      {desk || !index ? (
        <div className={desk ? 'r' : 'contents'}>
          <Outlet />
        </div>
      ) : null}
    </div>
  );
}

function ListColumn({
  desk,
  selected,
}: {
  desk: boolean;
  selected: string | null;
}) {
  // Choosing a row opens its post beside the list; focus stays on the row (the shell would move it to the title).
  const keepFocus = (id: string) => {
    keepFocusOnNavigationTo(`/pengumuman/${encodeURIComponent(id)}`);
    focusSoon(() =>
      document.querySelector<HTMLElement>(
        `[data-post-row="${CSS.escape(id)}"]`,
      ),
    );
  };
  // One element on every layout, so the list (and the search being typed) survives crossing 1024 px.
  return (
    <div className={desk ? 'in' : 'g-body g-feed-page'}>
      <FeedPanel
        desk={desk}
        selectedId={desk ? selected : null}
        onOpenRow={keepFocus}
      />
    </div>
  );
}

/** `/pengumuman`: the feed on phones and tablets; on desktop the first post beside the list, not marked read. */
export function FeedIndex() {
  const desk = useMediaQuery(DESKTOP_QUERY);
  return desk ? <DefaultSelection /> : null;
}

function DefaultSelection() {
  const view = useFeedView();
  const feed = useFeed(view);
  const first = feed.data?.pages[0]?.[0];
  // Offline with nothing kept, the list says so; the pane doesn't load forever beside it.
  if (feed.isPending)
    return feed.fetchStatus === 'paused' ? null : <DetailSkeleton desk />;
  if (!first) return <EmptyState title={t.feed.pilih} />;
  return <PostDetail info={first} desk search={view} />;
}

/** `/pengumuman/$id`: the post, marked read when it opens (its URL, a card, a row, a push). */
export function PostScreen() {
  const desk = useMediaQuery(DESKTOP_QUERY);
  const { id } = useParams({ from: POST_ROUTE });
  const view = useFeedView();
  const info = useInfo(id);
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const feed = useFeed(view);

  // Opening it marks it read once.
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (!info.data || marked.current === id) return;
    marked.current = id;
    if (!info.data.isRead) markRead.mutate({ id, read: true });
  }, [info.data, id, markRead]);

  // The card's comment button: the comment field takes focus.
  useEffect(() => {
    if (info.data && takeWantComment(id))
      focusSoon(() =>
        document.querySelector<HTMLElement>('[data-comment-field]'),
      );
  }, [info.data, id]);

  // Desktop: the member changed the view while this post was open and it left the list, so the first visible post
  // takes its place. Only a change since the list last settled counts: a post opened later (a push, Beranda, search)
  // stays even when it is beyond the pages loaded so far (review M1).
  const posts = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);
  const viewKey = JSON.stringify(canonicalView(view));
  const settledKey = useRef<string | null>(null);
  useEffect(() => {
    if (!desk || feed.isFetching || feed.isPlaceholderData || !feed.data)
      return;
    const before = settledKey.current;
    settledKey.current = viewKey;
    if (before === null || before === viewKey) return;
    const hidden = view.excludeCategories ?? [];
    const gone =
      !posts.some((p) => p.id === id) ||
      (info.data && hiddenByFilter(info.data, hidden));
    if (gone) void navigate({ to: '/pengumuman', search: view, replace: true });
  }, [
    desk,
    feed.isFetching,
    feed.isPlaceholderData,
    feed.data,
    viewKey,
    posts,
    id,
    info.data,
    view,
    navigate,
  ]);

  if (info.data)
    return <PostDetail info={info.data} desk={desk} search={view} />;
  if (info.error instanceof ApiError && info.error.status === 404)
    return <NotFound desk={desk} />;
  if (info.isError)
    return (
      <div className={desk ? 'g-detail desk' : 'g-detail'}>
        <ErrorState
          title={t.feed.gagal}
          onRetry={() => void info.refetch()}
          retrying={info.isFetching}
        />
      </div>
    );
  return <DetailSkeleton desk={desk} />;
}

function DetailSkeleton({ desk }: { desk: boolean }) {
  const late = useDelayed(true);
  if (!late) return null;
  return (
    <Skeleton
      label={t.feed.memuat}
      className={desk ? 'g-detail desk' : 'g-detail'}
    >
      <div className="grid gap-5">
        <SkeletonRow lines={['30%', '44%']} />
        <SkeletonBar width="70%" height={20} />
        <SkeletonBar width="100%" />
        <SkeletonBar width="94%" />
        <SkeletonBar width="60%" />
        <SkeletonBlock height={56} />
      </div>
    </Skeleton>
  );
}

/** A post that is gone or not for you (404), modelled on Curhat's `scrRoom` not-found state. */
function NotFound({ desk }: { desk: boolean }) {
  const navigate = useNavigate();
  const view = useFeedView();
  return (
    <div className={desk ? 'g-detail desk' : 'g-detail'}>
      {desk ? null : (
        <PageTitle className="sr-only">{t.post.tidakDitemukan}</PageTitle>
      )}
      <EmptyState
        title={t.post.tidakDitemukan}
        text={t.post.tidakDitemukanText}
        action={
          <Button
            variant="paper"
            size="sm"
            className="mt-2.5"
            onClick={() => void navigate({ to: '/pengumuman', search: view })}
          >
            {t.post.kembali}
          </Button>
        }
      />
    </div>
  );
}

/** `/pengumuman/tulis`: the focused page on phones and tablets; the dialog over the split on desktop. */
export function ComposeScreen() {
  const desk = useMediaQuery(DESKTOP_QUERY);
  useEffect(() => {
    if (!desk)
      focusSoon(() =>
        document.querySelector<HTMLElement>('[data-compose-title]'),
      );
  }, [desk]);
  if (desk)
    return (
      <>
        <DefaultSelection />
        <ComposeDialog />
      </>
    );
  return (
    <PageBody className="g-compose-page">
      <ComposePage />
    </PageBody>
  );
}
