import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { api } from '~/api/client';
import { CATEGORIES_QUERY_KEY, UNSUBSCRIBED_QUERY_KEY } from '~/api/constants';
import {
  ErrorState,
  Item,
  RuledList,
  SectionHead,
  Skeleton,
  SkeletonRow,
  Switch,
  toast,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { profil as copy } from '~/copy/profil';
import { categoryRows, type CategoryRow } from './rules';
import { PushCard } from './PushCard';
import { openInstallSheet } from './install-store';

type Muted = { userId: string; categoryId: string[] };

/** Profil › Notifikasi (garis/screens-more.js `scrNotif`): this device's push card, then a switch per category. */
export function NotifikasiScreen() {
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: [CATEGORIES_QUERY_KEY],
    queryFn: () => api.category.getListCategory(),
    select: (d) => d.categories,
  });
  const muted = useQuery({
    queryKey: [UNSUBSCRIBED_QUERY_KEY],
    queryFn: () => api.unsubscribe.getListUserUnsubscribeCategory(),
  });

  // Optimistic: the switch moves at once; a failure puts it back with an error toast.
  const toggle = useMutation({
    mutationFn: ({ row, on }: { row: CategoryRow; on: boolean }) =>
      on
        ? api.unsubscribe.deleteUserUnsubscribeCategory({
            requestBody: { categoryId: row.id },
          })
        : api.unsubscribe.postUserUnsubscribeCategory({
            requestBody: { categoryId: row.id },
          }),
    onMutate: async ({ row, on }) => {
      await qc.cancelQueries({ queryKey: [UNSUBSCRIBED_QUERY_KEY] });
      const before = qc.getQueryData<Muted>([UNSUBSCRIBED_QUERY_KEY]);
      qc.setQueryData<Muted>([UNSUBSCRIBED_QUERY_KEY], (m) =>
        m
          ? {
              ...m,
              categoryId: on
                ? m.categoryId.filter((id) => id !== row.id)
                : [...m.categoryId.filter((id) => id !== row.id), row.id],
            }
          : m,
      );
      return { before };
    },
    onError: (_e, { row }, ctx) => {
      qc.setQueryData([UNSUBSCRIBED_QUERY_KEY], ctx?.before);
      toast.error(fill(copy.notifikasi.gagal, { nama: row.name }));
    },
  });

  const failed = categories.isError || muted.isError;
  const loading = !failed && (!categories.data || !muted.data);
  const rows =
    categories.data && muted.data
      ? categoryRows(categories.data, muted.data.categoryId)
      : [];

  return (
    <>
      <DeskHead title={common.shell.notifikasi} />
      <PageBody className="gap-[18px]">
        <PushCard onInstall={openInstallSheet} />
        <div>
          <SectionHead title={copy.notifikasi.kategori} />
          {failed ? (
            <ErrorState
              onRetry={() => {
                void categories.refetch();
                void muted.refetch();
              }}
              retrying={categories.isFetching || muted.isFetching}
            />
          ) : loading ? (
            <Skeleton>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} tile={false} lines={['30%', '55%']} />
              ))}
            </Skeleton>
          ) : (
            <RuledList>
              {rows.map((row) => (
                <CategorySwitch
                  key={row.id}
                  row={row}
                  onChange={(on) => toggle.mutate({ row, on })}
                />
              ))}
            </RuledList>
          )}
        </div>
        <p className="t-cap text-fg-3">{copy.notifikasi.catatan}</p>
      </PageBody>
    </>
  );
}

function CategorySwitch({
  row,
  onChange,
}: {
  row: CategoryRow;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <li>
      <Item center>
        <span className="grow">
          <span className="block t-sub" id={id}>
            {row.name}
          </span>
          {row.note ? (
            <span className="block t-cap text-fg-3" id={noteId}>
              {row.note === 'wajib'
                ? copy.notifikasi.wajib
                : copy.notifikasi.akademik}
            </span>
          ) : null}
        </span>
        <Switch
          checked={row.on}
          locked={row.required}
          aria-labelledby={id}
          aria-describedby={row.note ? noteId : undefined}
          onClick={() => {
            if (row.required)
              toast.success(
                fill(copy.notifikasi.wajibToast, { nama: row.name }),
              );
          }}
          onCheckedChange={onChange}
        />
      </Item>
    </li>
  );
}
