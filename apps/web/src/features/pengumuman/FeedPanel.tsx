/**
 * The feed (`scrPengumuman`, `feedTools`, `feedList`): the title and Buat, search, Belum dibaca with the count, the
 * sort chip and Kategori, then the list: cards on phones and tablets, rows beside the post on desktop. Paging loads
 * the next page as the end scrolls into view (up to 5 pages), with Muat lagi as the fallback.
 */
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Info } from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  Modal,
  OfflineBanner,
  RuledList,
  Searchbox,
  Skeleton,
  SkeletonBar,
  SkeletonRow,
  Switch,
} from '~/components/garis';
import { IconSaring } from '~/components/icons/saring';
import { IconTambah } from '~/components/icons/tambah';
import { IconUrut } from '~/components/icons/urut';
import { PageTitle } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { pengumuman as t } from '~/copy/pengumuman';
import { DEBOUNCE_TIME } from '~/lib/constants';
import { hm } from '~/lib/dates';
import { useCategories, useFeed } from './data';
import { useUnreadIds } from './unread-query';
import { useDelayed, useElementInView, useOnline } from './parts';
import { PostCard, PostRow } from './PostCard';
import {
  AUTO_PAGES,
  canonicalView,
  emptyReason,
  toggleHidden,
  unreadLabel,
  type FeedView,
} from './rules';
import { focusSoon, takeCard, useFeedView, useSetView } from './view';

export function FeedPanel({
  desk,
  selectedId,
  onOpenRow,
}: {
  desk: boolean;
  /** Desktop: the post shown beside the list. */
  selectedId?: string | null;
  onOpenRow?: (id: string) => void;
}) {
  const view = useFeedView();
  const feed = useFeed(view);
  const posts = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);
  const online = useOnline();

  // Back from a post (phones and tablets): focus its card's link, after the shell's own focus step.
  useEffect(() => {
    const id = takeCard();
    if (id && !desk)
      focusSoon(() =>
        document.querySelector<HTMLElement>(
          `[data-post-link="${CSS.escape(id)}"]`,
        ),
      );
  }, [desk]);

  return (
    <>
      <div className="g-feed-head">
        <PageTitle>{common.nav.pengumuman}</PageTitle>
        <Button asChild variant="gold" size="sm">
          <Link
            to="/pengumuman/tulis"
            search={view}
            aria-label={t.feed.buatLabel}
          >
            <IconTambah size={16} />
            <span className="lbl">{t.feed.buat}</span>
          </Link>
        </Button>
      </div>
      <FeedTools view={view} />
      {!online && feed.data ? (
        <OfflineBanner updatedAt={hm(feed.dataUpdatedAt)} />
      ) : null}
      <FeedList
        desk={desk}
        view={view}
        feed={feed}
        posts={posts}
        selectedId={selectedId}
        onOpenRow={onOpenRow}
      />
    </>
  );
}

function FeedTools({ view }: { view: FeedView }) {
  const setView = useSetView();
  const v = canonicalView(view);
  const { data: unread } = useUnreadIds();
  const [q, setQ] = useState(view.search ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const hidden = v.excludeCategories ?? [];

  // The URL changed elsewhere (Tampilkan semua, back): the field follows.
  useEffect(() => {
    setQ((cur) =>
      cur.trim() === (view.search ?? '').trim() ? cur : (view.search ?? ''),
    );
  }, [view.search]);
  useEffect(
    () => () => void (timer.current && clearTimeout(timer.current)),
    [],
  );

  const count = unreadLabel(unread?.length ?? 0);
  return (
    <>
      <Searchbox
        label={t.feed.cariLabel}
        placeholder={t.feed.cariPlaceholder}
        value={q}
        onChange={(e) => {
          const value = e.target.value;
          setQ(value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(
            () => setView({ search: value.trim() ? value : undefined }),
            DEBOUNCE_TIME,
          );
        }}
      />
      <div className="g-list-tools" role="group" aria-label={t.feed.saring}>
        <button
          type="button"
          className="g-chip"
          aria-pressed={!!v.unread}
          onClick={() => setView({ unread: !v.unread || undefined })}
        >
          {t.feed.belumDibaca}
          {count ? <span className="n">{count}</span> : null}
        </button>
        <button
          type="button"
          className="g-chip"
          aria-label={fill(t.feed.urutan, {
            urutan:
              v.sort === 'oldest' ? t.feed.urutanTerlama : t.feed.urutanTerbaru,
          })}
          onClick={() =>
            setView({ sort: v.sort === 'oldest' ? undefined : 'oldest' })
          }
        >
          <IconUrut size={16} />
          {v.sort === 'oldest' ? t.feed.terlama : t.feed.terbaru}
        </button>
        <button
          type="button"
          className="g-chip"
          aria-haspopup="dialog"
          aria-pressed={hidden.length > 0}
          onClick={() => setFilterOpen(true)}
          data-filter-chip=""
        >
          <IconSaring size={16} />
          {t.feed.kategori}
          {hidden.length ? (
            <span className="n">
              {fill(t.feed.disembunyikan, { jumlah: hidden.length })}
            </span>
          ) : null}
        </button>
      </div>
      <FilterOverlay
        open={filterOpen}
        onOpenChange={setFilterOpen}
        hidden={hidden}
        onToggle={(name) =>
          setView({ excludeCategories: toggleHidden(hidden, name) })
        }
        onReset={() => {
          setQ('');
          setView(null);
          setFilterOpen(false);
        }}
      />
    </>
  );
}

/** "Kategori yang ditampilkan" (`OV.filter`): a switch per category; a sheet on phones, a dialog on desktop. */
function FilterOverlay({
  open,
  onOpenChange,
  hidden,
  onToggle,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hidden: string[];
  onToggle: (name: string) => void;
  onReset: () => void;
}) {
  const { data: categories } = useCategories();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.filter.judul}
      footer={
        <>
          <Button variant="paper" onClick={onReset}>
            {t.filter.tampilkanSemua}
          </Button>
          <Button variant="gold" onClick={() => onOpenChange(false)}>
            {t.filter.selesai}
          </Button>
        </>
      }
    >
      <RuledList>
        {(categories ?? []).map((c) => (
          <li key={c.id} className="g-item center">
            <span className="min-w-0 flex-1 t-sub" id={`fc-${c.id}`}>
              {c.name}
            </span>
            <Switch
              checked={!hidden.includes(c.name)}
              onCheckedChange={() => onToggle(c.name)}
              aria-labelledby={`fc-${c.id}`}
            />
          </li>
        ))}
      </RuledList>
      <p className="t-cap text-fg-3">{t.filter.catatan}</p>
    </Modal>
  );
}

function FeedList({
  desk,
  view,
  feed,
  posts,
  selectedId,
  onOpenRow,
}: {
  desk: boolean;
  view: FeedView;
  feed: ReturnType<typeof useFeed>;
  posts: Info[];
  selectedId?: string | null;
  onOpenRow?: (id: string) => void;
}) {
  const setView = useSetView();
  // A callback ref: the end marker first renders after the loading state.
  const [end, setEnd] = useState<HTMLDivElement | null>(null);
  const atEnd = useElementInView(end, false);
  const pages = feed.data?.pages.length ?? 0;
  const loading = feed.isPending;
  const showSkeleton = useDelayed(loading);

  useEffect(() => {
    if (
      atEnd &&
      feed.hasNextPage &&
      !feed.isFetchingNextPage &&
      pages < AUTO_PAGES
    )
      void feed.fetchNextPage();
  }, [atEnd, feed, pages]);

  // Offline with nothing kept from before: say so instead of loading forever.
  if (loading && feed.fetchStatus === 'paused')
    return (
      <ErrorState
        title={t.feed.gagal}
        text={common.errors.sesi}
        onRetry={() => void feed.refetch()}
      />
    );

  if (loading)
    return showSkeleton ? (
      <Skeleton label={t.feed.memuat}>
        {desk ? (
          <div className="grid gap-4 pt-2">
            <SkeletonRow tile={false} />
            <SkeletonRow tile={false} />
            <SkeletonRow tile={false} />
          </div>
        ) : (
          <div className="grid gap-6 pt-2">
            {[0, 1].map((i) => (
              <div key={i} className="grid gap-3">
                <SkeletonRow lines={['40%', '24%']} />
                <SkeletonBar width="86%" height={14} />
                <SkeletonBar width="100%" />
                <SkeletonBar width="70%" />
              </div>
            ))}
          </div>
        )}
      </Skeleton>
    ) : null;

  if (feed.isError && !posts.length)
    return (
      <ErrorState
        title={t.feed.gagal}
        onRetry={() => void feed.refetch()}
        retrying={feed.isFetching}
      />
    );

  if (!posts.length) {
    // With nothing narrowing the list there's no reason to give and nothing for Tampilkan semua to reset.
    const why = emptyReason(view);
    return (
      <EmptyState
        title={t.feed.kosong}
        text={why ?? undefined}
        action={
          why ? (
            <Button
              variant="paper"
              size="sm"
              className="mt-2.5"
              onClick={() => setView(null)}
            >
              {t.feed.tampilkanSemua}
            </Button>
          ) : undefined
        }
      />
    );
  }

  const search = view;
  return (
    <div>
      {desk ? (
        <RuledList>
          {posts.map((p) => (
            <PostRow
              key={p.id}
              info={p}
              selected={p.id === selectedId}
              search={search}
              onOpen={(id) => onOpenRow?.(id)}
            />
          ))}
        </RuledList>
      ) : (
        <ul className="g-feed">
          {posts.map((p) => (
            <PostCard key={p.id} info={p} search={search} />
          ))}
        </ul>
      )}
      <div ref={setEnd} aria-hidden="true" />
      {feed.hasNextPage ? (
        <div className="g-more">
          <Button
            variant="paper"
            size="sm"
            onClick={() => {
              if (!feed.isFetchingNextPage) void feed.fetchNextPage();
            }}
            aria-disabled={feed.isFetchingNextPage || undefined}
          >
            {t.feed.muatLagi}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
