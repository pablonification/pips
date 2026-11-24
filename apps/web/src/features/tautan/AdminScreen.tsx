import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Button,
  ErrorState,
  RuledList,
  Searchbox,
  Seg,
  Skeleton,
  SkeletonRow,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { tautan as copy } from '~/copy/tautan';
import { useRoleLoss } from '~/features/kelola/KelolaGate';
import { useDebounced } from '~/features/layanan-svc/parts';
import { serviceById } from '~/lib/services';
import { LinkRow } from './parts';
import { adminLinksQuery, type AdminSummary, type AdminView } from './queries';
import { adminCount, moreLabel } from './rules';
import './tautan.css';

/**
 * Kelola › Tautan pendek, for admin: every link with its holder, or "Belum diambil" with the old account it came from.
 * Search finds a name, a destination, a holder's name or NIM, or an old username; 50 rows at a time.
 */
export function AdminScreen() {
  const k = copy.kelola;
  const [q, setQ] = useState('');
  const [view, setView] = useState<AdminView>('all');
  const search = useDebounced(q.trim(), 300);
  const list = useInfiniteQuery({
    ...adminLinksQuery(search, view),
    placeholderData: keepPreviousData,
  });
  useRoleLoss(list.error);
  const first = list.data?.pages[0];
  const links = (list.data?.pages.flatMap((p) => p.links) ??
    []) as AdminSummary[];
  const more = first ? moreLabel(links.length, first.total) : null;

  return (
    <>
      <DeskHead title={serviceById('kelola-tautan').label} />
      <PageBody wide className="sl-body sl-wrap">
        <div className="sl-tools">
          <Searchbox
            label={k.cari}
            placeholder={k.cariPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
          <Seg
            label={k.tampilan}
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: k.semua },
              { value: 'unclaimed', label: k.belumDiambil },
            ]}
          />
        </div>
        <p className="sl-count t-cap text-fg-2" role="status">
          {first ? adminCount(view, search, first.total, first.accounts) : ''}
        </p>
        {!first ? (
          list.isError ? (
            <ErrorState
              title={k.gagal}
              onRetry={() => void list.refetch()}
              retrying={list.isFetching}
            />
          ) : (
            <Skeleton label={k.memuat}>
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} lines={['46%', '72%', '30%']} />
              ))}
            </Skeleton>
          )
        ) : links.length === 0 ? (
          <p className="sl-none t-sm text-fg-2">
            {fill(k.tidakAda, { q: search })}
          </p>
        ) : (
          <RuledList className="sl-list sl-admin">
            {links.map((l) => (
              <LinkRow
                key={l.id}
                link={l}
                admin
                to={{ to: '/kelola/tautan/$id', id: l.id }}
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
    </>
  );
}
