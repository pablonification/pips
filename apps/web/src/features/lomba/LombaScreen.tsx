import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
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
import { DeskHead, PageBody } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { lomba as copy } from '~/copy/lomba';
import { hm } from '~/lib/dates';
import { serviceById } from '~/lib/services';
import { cn } from '~/lib/utils';
import { NewTab, useOnline } from '~/features/layanan-svc/parts';
import { deadlineLine, isOpen, isUrgent, rupiah, withScheme } from './rules';
import { competitionsQuery } from './queries';

/** One competition (garis/screens-more.js `scrLomba`'s card). */
function LombaCard({ c, now }: { c: Competition; now: number }) {
  const deadline = c.registrationDeadline || null;
  return (
    <li className="g-lomba">
      <h2 className="t-sub">{c.name}</h2>
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
 * **Muat lagi** does the same from the keyboard. No add button here: P3-B adds Tambah lomba for cnc.
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
          <OfflineBanner updatedAt={hm(list.dataUpdatedAt || now)} />
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
            onRetry={() => void fetchNextPage()}
            retrying={online && list.isFetchingNextPage}
          />
        ) : hasNextPage ? (
          <div ref={endRef} className="flex justify-center">
            <Button
              variant="paper"
              size="sm"
              aria-disabled={list.isFetchingNextPage || undefined}
              onClick={() => {
                if (!list.isFetchingNextPage) void fetchNextPage();
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
      <DeskHead title={serviceById('lomba').label} />
      <PageBody className="gap-2.5">{content}</PageBody>
    </>
  );
}
