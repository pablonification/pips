import {
  keepPreviousData,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { ShortLinkList } from '~/api/generated';
import {
  Button,
  DESKTOP_QUERY,
  ErrorState,
  OfflineBanner,
  RuledList,
  Searchbox,
  Seg,
  Skeleton,
  SkeletonRow,
  useMediaQuery,
} from '~/components/garis';
import { IconAmbil } from '~/components/icons/ambil';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconPendek } from '~/components/icons/pendek';
import { IconTambah } from '~/components/icons/tambah';
import { DeskHead, PageBody, TopBarActions } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { tautan as copy } from '~/copy/tautan';
import { useDebounced } from '~/features/layanan-svc/parts';
import { offlineUpdatedAt } from '~/features/layanan-svc/updated';
import { useOnline } from '~/hooks/useOnline';
import { MakeDialog } from './MakeDialog';
import { LinkRow, SlState } from './parts';
import { myLinksQuery, takeFresh, type Order, type Summary } from './queries';
import { moreLabel } from './rules';
import './tautan.css';

const flat = (d: InfiniteData<ShortLinkList> | undefined) =>
  (d?.pages.flatMap((p) => p.links) ?? []) as Summary[];

/**
 * Tautan pendek: the member's links and their published forms' links. Search and the two orders stay at the top;
 * 50 rows at a time. While old accounts can still be claimed, one quiet row (phones and tablets) or a page-head button
 * (desktop) leads to "Ambil tautan lama". `startMaking`: open "Buat tautan pendek" at once (global search).
 */
export function TautanScreen({
  startMaking = false,
}: {
  startMaking?: boolean;
}) {
  const navigate = useNavigate();
  const online = useOnline();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const [q, setQ] = useState('');
  const [order, setOrder] = useState<Order>('new');
  const search = useDebounced(q.trim(), 300);
  const [making, setMaking] = useState(startMaking);
  const [fresh, setFresh] = useState(takeFresh);
  const list = useInfiniteQuery({
    ...myLinksQuery(search, order),
    placeholderData: keepPreviousData,
  });

  // Global search opened it with ?buat=tautan: the dialog is open; the address goes back to the list's own.
  useEffect(() => {
    if (startMaking)
      void navigate({ to: '/layanan/tautan', search: {}, replace: true });
  }, [startMaking, navigate]);

  const first = list.data?.pages[0];
  const links = flat(list.data);
  const total = first?.total ?? 0;
  const claimOpen = !!first?.claim.open;
  // Nothing at all: no links, nothing typed, and the answer is for no search.
  const none = !!first && !search && !q.trim() && total === 0;
  const more = moreLabel(links.length, total);

  const makeBtn = (gold = true) => (
    <Button
      variant="gold"
      size={gold ? 'sm' : 'md'}
      onClick={() => setMaking(true)}
    >
      <IconTambah size={16} />
      {copy.daftar.buat}
    </Button>
  );
  const claimBtn = (variant: 'ghost' | 'paper') =>
    claimOpen ? (
      <Button variant={variant} asChild>
        <Link to="/layanan/tautan/ambil">
          <IconAmbil size={16} />
          {copy.daftar.ambilLama}
        </Link>
      </Button>
    ) : null;

  const dialog = (
    <MakeDialog
      open={making}
      onOpenChange={setMaking}
      onMade={(id) => {
        // The new link is on top of the list when it shows again, washed gold.
        setQ('');
        setOrder('new');
        setFresh(new Set([id]));
      }}
    />
  );

  if (!first) {
    return (
      <>
        <DeskHead title={copy.judul} />
        <PageBody>
          {list.isError || !online ? (
            <ErrorState
              title={copy.daftar.gagal}
              text={online ? undefined : copy.daftar.periksaKoneksi}
              onRetry={() => void list.refetch()}
              retrying={online && list.isFetching}
            />
          ) : (
            <Skeleton label={copy.daftar.memuat}>
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} lines={['46%', '72%']} />
              ))}
            </Skeleton>
          )}
        </PageBody>
        {dialog}
      </>
    );
  }

  if (none)
    return (
      <>
        <DeskHead title={copy.judul} />
        <PageBody>
          <SlState icon={<IconPendek size={24} />} title={copy.daftar.kosong}>
            <Button variant="gold" onClick={() => setMaking(true)}>
              <IconTambah size={16} />
              {copy.daftar.buat}
            </Button>
            {claimBtn('paper')}
          </SlState>
        </PageBody>
        {dialog}
      </>
    );

  return (
    <>
      <DeskHead
        title={copy.judul}
        actions={
          <div className="flex flex-wrap gap-2">
            {claimBtn('ghost')}
            {makeBtn(false)}
          </div>
        }
      />
      <TopBarActions>{makeBtn()}</TopBarActions>
      <PageBody wide className="sl-body sl-wrap">
        <div className="sl-tools">
          <Searchbox
            label={copy.daftar.cari}
            placeholder={copy.daftar.cariPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
          <Seg
            label={copy.daftar.urutkan}
            value={order}
            onChange={setOrder}
            options={[
              { value: 'new', label: copy.daftar.terbaru },
              { value: 'clicks', label: copy.daftar.palingDiklik },
            ]}
          />
        </div>
        <p className="sl-count t-cap text-fg-2" role="status">
          {search && !list.isPlaceholderData
            ? fill(copy.daftar.cocok, { jumlah: total.toLocaleString('id-ID') })
            : ''}
        </p>
        {online ? null : (
          <OfflineBanner
            updatedAt={offlineUpdatedAt(
              list.dataUpdatedAt || Date.now(),
              Date.now(),
            )}
          />
        )}
        {claimOpen && !desk && !q.trim() ? (
          <div>
            <Link to="/layanan/tautan/ambil" className="sl-claim-row">
              <IconAmbil size={20} />
              <span className="grow">{copy.daftar.ambilBaris}</span>
              <span className="g-chev text-fg-3">
                <IconLanjut size={18} />
              </span>
            </Link>
          </div>
        ) : null}
        {links.length === 0 && search ? (
          <p className="sl-none t-sm text-fg-2">
            {fill(copy.daftar.tidakAda, { q: search })}
          </p>
        ) : (
          <RuledList className="sl-list">
            {links.map((l) => (
              <LinkRow
                key={l.id}
                link={l}
                fresh={fresh.has(l.id)}
                to={{ to: '/layanan/tautan/$id', id: l.id }}
              />
            ))}
          </RuledList>
        )}
        {more ? (
          <Button
            variant="paper"
            className="sl-more"
            aria-disabled={list.isFetchingNextPage || undefined}
            onClick={() => {
              if (!list.isFetchingNextPage) void list.fetchNextPage();
            }}
          >
            {more.label} <span className="text-fg-3 num">{more.left}</span>
          </Button>
        ) : null}
      </PageBody>
      {dialog}
    </>
  );
}
