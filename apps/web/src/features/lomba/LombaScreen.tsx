import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import type { Competition } from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  OfflineBanner,
  RuledList,
  Skeleton,
  SkeletonRow,
  Tag,
} from '~/components/garis';
import { IconKas } from '~/components/icons/kas';
import { IconLuar } from '~/components/icons/luar';
import { IconTenggat } from '~/components/icons/tenggat';
import { DeskHead, PageBody, TopBarActions } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { lomba as copy } from '~/copy/lomba';
import { serviceById } from '~/lib/services';
import { cn } from '~/lib/utils';
import { NewTab, useOnline } from '~/features/layanan-svc/parts';
import { TambahLomba } from '~/features/kelola-lomba/Manage';
import { offlineUpdatedAt } from '~/features/layanan-svc/updated';
import { deadlineLine, isOpen, isUrgent, rupiah, withScheme } from './rules';
import { competitionsQuery } from './queries';

/** One competition (garis/screens-more.js `scrLomba`'s card). */
function LombaCard({ c, now }: { c: Competition; now: number }) {
  const deadline = c.registrationDeadline || null;
  return (
    <li className="g-lomba">
      {/* Focusable from code: after Muat lagi, focus moves to the first competition that arrived. */}
      <h2 className="t-sub" tabIndex={-1}>
        {c.name}
      </h2>
      <p className="t-cap text-fg-2">{c.organizer}</p>
      {c.categories.length ? (
        <div className="g-lomba-cats">
          {c.categories.map((cat) => (
            <Tag key={cat}>{cat}</Tag>
          ))}
        </div>
      ) : null}
      <div className="g-lomba-facts">
        {deadline ? (
          <span
            className={cn('g-lomba-fact', isUrgent(deadline, now) && 'urgent')}
          >
            <IconTenggat size={16} />
            {deadlineLine(deadline)}
          </span>
        ) : null}
        <span className="g-lomba-fact">
          <IconKas size={16} />
          {rupiah(c.price)}
        </span>
      </div>
      <div className="g-lomba-acts">
        <Button variant="gold" size="sm" asChild>
          <a
            href={withScheme(c.registrationUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.daftar}
            <span className="sr-only">
              {fill(copy.daftarLabel, { nama: c.name }).slice(
                copy.daftar.length,
              )}
            </span>
            <IconLuar size={16} />
            <NewTab />
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a
            href={withScheme(c.sourceUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.sumber}
            <span className="sr-only">
              {fill(copy.sumberLabel, { nama: c.name }).slice(
                copy.sumber.length,
              )}
            </span>
            <NewTab />
          </a>
        </Button>
      </div>
    </li>
  );
}

/**
 * Info Lomba for members (garis/screens-more.js `scrLomba`): open competitions, soonest deadline first, one clear
 * deadline each. Every page is reachable (SPEC story 78): more load when the list's end scrolls into view, and
 * **Muat lagi** does the same from the keyboard. P3-B adds Tambah lomba, for cnc only.
 */
export function LombaScreen() {
  const online = useOnline();
  const list = useInfiniteQuery(competitionsQuery);
  const { ref: endRef, inView } = useInView();
  const now = Date.now();
  const { hasNextPage, isFetching, isError, fetchNextPage } = list;
  useEffect(() => {
    if (inView && hasNextPage && !isFetching && !isError && online)
      void fetchNextPage();
  }, [inView, hasNextPage, isFetching, isError, online, fetchNextPage]);

  const pages = list.data?.pages;
  const shown = (pages ?? [])
    .flat()
    .filter((c) => isOpen(c.registrationDeadline, now));

  // Keyboard users keep their place (P2-B review, finding 1): when a load started by Muat lagi (or the next page's
  // Coba lagi) ends and the button that had focus is gone, focus goes to the first competition that arrived, to
  // Coba lagi when it failed, or back to Muat lagi when more remain. Loads started by scrolling move nothing.
  const bodyId = useId();
  const moreRef = useRef<HTMLButtonElement>(null);
  const pressedAt = useRef<number | null>(null);
  const loadMore = () => {
    pressedAt.current ??= shown.length;
    void fetchNextPage();
  };
  const { isFetchingNextPage, isFetchNextPageError } = list;
  useEffect(() => {
    const from = pressedAt.current;
    if (from === null || isFetchingNextPage) return;
    const lost =
      !document.activeElement || document.activeElement === document.body;
    const body = document.getElementById(bodyId);
    if (isFetchNextPageError) {
      if (lost)
        body
          ?.querySelector<HTMLButtonElement>('[role="alert"] button')
          ?.focus();
      return;
    }
    pressedAt.current = null;
    if (!lost) return;
    if (hasNextPage) {
      moreRef.current?.focus();
      return;
    }
    const titles = body?.querySelectorAll<HTMLElement>('.g-lomba h2') ?? [];
    (titles[from] ?? titles[titles.length - 1])?.focus();
  }, [bodyId, isFetchingNextPage, isFetchNextPageError, hasNextPage]);

  let content;
  if (!pages) {
    content =
      list.isError || !online ? (
        <ErrorState
          title={copy.gagal}
          text={online ? undefined : copy.periksaKoneksi}
          onRetry={() => void list.refetch()}
          retrying={online && list.isFetching}
        />
      ) : (
        <Skeleton label={copy.memuat}>
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} tile={false} lines={['56%', '34%', '42%']} />
          ))}
        </Skeleton>
      );
  } else {
    content = (
      <>
        {online ? null : (
          <OfflineBanner
            updatedAt={offlineUpdatedAt(list.dataUpdatedAt || now, now)}
          />
        )}
        {shown.length ? (
          <RuledList>
            {shown.map((c) => (
              <LombaCard key={c.id} c={c} now={now} />
            ))}
          </RuledList>
        ) : hasNextPage ? null : (
          <EmptyState title={copy.kosong} text={copy.kosongIsi} />
        )}
        {list.isFetchNextPageError ? (
          <ErrorState
            title={copy.gagalBerikutnya}
            text={online ? undefined : copy.periksaKoneksi}
            onRetry={loadMore}
            retrying={online && list.isFetchingNextPage}
          />
        ) : hasNextPage ? (
          <div ref={endRef} className="flex justify-center">
            <Button
              ref={moreRef}
              variant="paper"
              size="sm"
              aria-disabled={list.isFetchingNextPage || undefined}
              onClick={() => {
                if (!list.isFetchingNextPage) loadMore();
              }}
            >
              {copy.muatLagi}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <DeskHead title={serviceById('lomba').label} actions={<TambahLomba />} />
      <TopBarActions>
        <TambahLomba />
      </TopBarActions>
      <PageBody id={bodyId} className="gap-2.5">
        {content}
      </PageBody>
    </>
  );
}
