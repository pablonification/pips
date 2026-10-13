import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from '@tanstack/react-router';
import {
  EmptyState,
  ErrorState,
  RowButton,
  RuledList,
  Skeleton,
  SkeletonRow,
  Tile,
} from '~/components/garis';
import { IconForm } from '~/components/icons/form';
import { IconLanjut } from '~/components/icons/lanjut';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { kelola as copy } from '~/copy/kelola';
import { shortWhen } from '~/lib/form/format';
import { useRoleLoss } from './KelolaGate';
import { adminFormsQuery } from './queries';
import { formCaption, formsEntry } from './rules';
import '~/styles/garis/kelola.css';

/**
 * Choosing a form (/kelola/live). One active form goes straight to its live page (replacing this entry, so back
 * goes to Kelola: the prototype's one tap); two or more list, in the API's order; none says so. There's no locked
 * screen for the list: it is Layanan's row with the form tile (a deviation for the owner).
 */
export function FormsEntry() {
  const forms = useQuery(adminFormsQuery());
  useRoleLoss(forms.error);
  const entry = forms.data ? formsEntry(forms.data) : null;
  if (entry?.kind === 'forward')
    return (
      <Navigate
        to="/kelola/live/$formId"
        params={{ formId: entry.formId }}
        replace
      />
    );
  return (
    <>
      <DeskHead title={common.shell.liveCounting} />
      <PageBody className="gap-3.5">
        {forms.isPending ? (
          <Skeleton label={copy.formulir.memuat}>
            <SkeletonRow tile lines={['60%', '40%']} />
            <SkeletonRow tile lines={['50%', '35%']} />
          </Skeleton>
        ) : forms.isError ? (
          <ErrorState
            title={copy.formulir.gagal}
            onRetry={() => void forms.refetch()}
            retrying={forms.isFetching}
          />
        ) : entry?.kind === 'empty' ? (
          <EmptyState title={copy.formulir.belumAda} />
        ) : (
          <RuledList>
            {forms.data.map((f) => (
              <li key={f.id}>
                <RowButton asChild>
                  <Link to="/kelola/live/$formId" params={{ formId: f.id }}>
                    <span className="g-svc-row">
                      <Tile>
                        <IconForm size={20} />
                      </Tile>
                      <span className="min-w-0 flex-1">
                        <span className="block t-sub">{f.title}</span>
                        <span className="block t-cap text-fg-2">
                          {formCaption(f, shortWhen)}
                        </span>
                      </span>
                      <span className="g-chev text-fg-3">
                        <IconLanjut size={18} />
                      </span>
                    </span>
                  </Link>
                </RowButton>
              </li>
            ))}
          </RuledList>
        )}
      </PageBody>
    </>
  );
}
