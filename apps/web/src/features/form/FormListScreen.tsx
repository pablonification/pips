import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { FormListItem } from '~/api/generated';
import {
  Due,
  EmptyState,
  ErrorState,
  OfflineBanner,
  RowButton,
  RuledList,
  Skeleton,
  SkeletonRow,
  StatusTag,
  Tag,
} from '~/components/garis';
import { IconForm } from '~/components/icons/form';
import { IconLanjut } from '~/components/icons/lanjut';
import { DeskHead, PageBody } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { form as formCopy } from '~/copy/form';
import { isi } from '~/copy/isi';
import useSession from '~/hooks/auth/useSession';
import { useOnline } from '~/hooks/useOnline';
import { dayDiff } from '~/lib/dates';
import { readDraft } from '~/lib/form/draft-store';
import { clockWhen } from '~/lib/form/format';
import { DRAFT_HOURS, draftKey } from '~/lib/form/rules';
import { serviceById } from '~/lib/services';
import { formListQuery, myResponseQuery } from './queries';
import {
  dayShort,
  rowState,
  sortRows,
  whenShort,
  type RowState,
} from './rules';
import './form.css';

/**
 * Layanan › Form: one row per form for your angkatan, open first, then the ones not open yet, sent and closed. Each
 * row says the one date that matters and its state in icon, word and colour (Isi sekarang or Lanjutkan with a draft).
 */
export function FormListScreen() {
  const me = useSession();
  const list = useQuery(formListQuery());
  const online = useOnline();
  const forms = list.data?.forms ? sortRows(list.data.forms) : undefined;

  // When a sent form was sent, and which open forms have a draft on this device.
  const sentAt = useQueries({
    queries: (forms ?? [])
      .filter((f) => rowState(f) === 'done')
      .map((f) => myResponseQuery(f.id)),
  });
  const drafts = useQuery({
    queryKey: ['form-drafts', me.id, (forms ?? []).map((f) => f.id).join()],
    queryFn: async () => {
      const open = (forms ?? []).filter((f) => rowState(f) === 'open');
      const found = await Promise.all(
        open.map((f) => readDraft(draftKey(f.id, me.id), DRAFT_HOURS)),
      );
      return open.filter((_, i) => found[i]).map((f) => f.id);
    },
    enabled: !!forms,
    staleTime: 0,
    gcTime: 0,
  });
  const submitted = new Map(
    sentAt.flatMap((q) =>
      q.data ? [[q.data.formId, q.data.submittedAt]] : [],
    ),
  );

  let inner;
  if (forms) {
    inner = forms.length ? (
      <RuledList>
        {forms.map((f) => (
          <Row
            key={f.id}
            f={f}
            state={rowState(f)}
            draft={drafts.data?.includes(f.id) ?? false}
            sentAt={submitted.get(f.id)}
          />
        ))}
      </RuledList>
    ) : (
      <EmptyState
        title={formCopy.daftar.kosongJudul}
        text={formCopy.daftar.kosongIsi}
      />
    );
  } else if (list.isError) {
    inner = (
      <ErrorState
        title={formCopy.daftar.gagal}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    );
  } else {
    inner = (
      <Skeleton label={formCopy.daftar.memuat}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </Skeleton>
    );
  }

  return (
    <>
      <DeskHead title={serviceById('form').label} />
      <PageBody style={{ gap: 14 }}>
        {!online && forms ? (
          <OfflineBanner updatedAt={clockWhen(list.dataUpdatedAt)} />
        ) : null}
        {inner}
      </PageBody>
    </>
  );
}

function Row({
  f,
  state,
  draft,
  sentAt,
}: {
  f: FormListItem;
  state: RowState;
  draft: boolean;
  sentAt?: string;
}) {
  const d = isi.daftar;
  let meta;
  if (state === 'open')
    meta = f.closesAt ? (
      <Due urgent={dayDiff(f.closesAt) <= 1}>
        {fill(d.tutup, { waktu: whenShort(f.closesAt) })}
      </Due>
    ) : (
      d.tanpaBatas
    );
  else if (state === 'soon')
    meta = fill(d.dibuka, { waktu: whenShort(f.opensAt) });
  else if (state === 'done')
    meta = sentAt ? fill(d.terkirim, { hari: dayShort(sentAt) }) : null;
  else
    meta = f.closesAt ? fill(d.ditutup, { hari: dayShort(f.closesAt) }) : null;
  return (
    <li>
      <RowButton asChild>
        <Link to="/layanan/form/$formId" params={{ formId: f.id }}>
          <span className="fl-row">
            <span className="grow">
              <span className="block t-sub">{f.title}</span>
              {meta ? <span className="meta">{meta}</span> : null}
            </span>
            {state === 'open' && draft ? (
              <Tag tone="accent" icon={<IconForm size={16} />}>
                {d.lanjutkan}
              </Tag>
            ) : (
              <StatusTag status={state} />
            )}
            <span className="g-chev">
              <IconLanjut size={18} />
            </span>
          </span>
        </Link>
      </RowButton>
    </li>
  );
}
