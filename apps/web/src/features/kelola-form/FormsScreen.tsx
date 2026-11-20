import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ManageFormListItem } from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  RowButton,
  RuledList,
  SectionHead,
  Seg,
  Skeleton,
  SkeletonRow,
  toast,
} from '~/components/garis';
import { IconMata } from '~/components/icons/mata';
import { IconPensil } from '~/components/icons/pensil';
import { IconTambah } from '~/components/icons/tambah';
import { keepFocusOnNavigationTo } from '~/components/shell/focus';
import { DeskHead, PageBody, TopBarActions } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import useSession from '~/hooks/auth/useSession';
import { can } from '~/lib/capabilities';
import { angkatanQuery } from '../profil/queries';
import { useRoleLoss } from '../kelola/KelolaGate';
import { MakerStatus } from './parts';
import { createForm, keepForm, managedFormsQuery } from './queries';
import { rowCaption, sharedAs, splitForms } from './rules';
import '~/styles/garis/form-builder.css';

/**
 * Kelola › Form: Buatanku and Dibagikan ke aku, newest change first; admin switches to Semua form. Each row: title,
 * audience and the one date that matters, who shared it and as what, its state (icon, word, colour) and its answers.
 * "Buat form" makes a draft and opens it with the title in focus.
 */
export function FormsScreen({ all }: { all: boolean }) {
  const me = useSession();
  const admin = can(me, 'manageAllForms');
  const scope = admin && all ? 'all' : 'mine';
  const forms = useQuery(managedFormsQuery(scope));
  const angkatan = useQuery(angkatanQuery());
  useRoleLoss(forms.error);
  const navigate = useNavigate();
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: createForm,
    onSuccess: (form) => {
      keepForm(client, form);
      // The new form's title takes focus, not the page heading the shell would focus.
      keepFocusOnNavigationTo(`/kelola/form/${form.id}`);
      void navigate({
        to: '/kelola/form/$formId',
        params: { formId: form.id },
        state: { baru: true } as never,
      });
    },
    onError: () => toast.error(copy.daftar.gagalBuat),
  });
  const newForm = (
    <Button
      variant="gold"
      size="sm"
      aria-disabled={create.isPending || undefined}
      onClick={() => {
        if (!create.isPending) create.mutate();
      }}
    >
      <IconTambah size={16} />
      {create.isPending ? copy.daftar.membuat : copy.daftar.buatForm}
    </Button>
  );

  const row = (f: ManageFormListItem) => {
    const owner = f.access.role === 'owner';
    const as = sharedAs(f);
    const shared = f.access.role === 'view' || f.access.role === 'edit';
    return (
      <li key={f.id}>
        <RowButton asChild>
          <Link to="/kelola/form/$formId" params={{ formId: f.id }}>
            <span className="fb-row">
              <span className="min-w-0">
                <span className="block t-sub">
                  {f.title.trim() || copy.daftar.tanpaJudul}
                </span>
                <span className="block t-cap text-fg-2 num">
                  {rowCaption(f, angkatan.data)}
                </span>
                {owner || !f.owner ? null : (
                  <span className="fb-from t-cap text-fg-2">
                    {shared ? (
                      <>
                        {as === 'edit' ? (
                          <IconPensil size={16} />
                        ) : (
                          <IconMata size={16} />
                        )}
                        {as === 'edit'
                          ? copy.daftar.bisaEdit
                          : copy.daftar.lihatJawaban}
                        <span className="sep" aria-hidden="true">
                          ·
                        </span>
                      </>
                    ) : null}
                    {fill(copy.daftar.dari, { nama: f.owner.fullName })}
                  </span>
                )}
              </span>
              <span className="st">
                <MakerStatus status={f.status} />
              </span>
              <span className="n">
                {f.status === 'open' || f.status === 'closed' ? (
                  <>
                    <b aria-hidden="true">{f.responseCount}</b>
                    <span aria-hidden="true">{copy.daftar.jawaban}</span>
                    <span className="sr-only">
                      {fill(copy.daftar.jawabanJumlah, {
                        jumlah: f.responseCount,
                      })}
                    </span>
                  </>
                ) : null}
              </span>
            </span>
          </Link>
        </RowButton>
      </li>
    );
  };

  let body;
  if (forms.isPending)
    body = (
      <Skeleton label={copy.daftar.memuat}>
        <SkeletonRow lines={['60%', '40%']} />
        <SkeletonRow lines={['50%', '35%']} />
        <SkeletonRow lines={['55%', '30%']} />
      </Skeleton>
    );
  else if (forms.isError)
    body = (
      <ErrorState
        title={copy.daftar.gagal}
        onRetry={() => void forms.refetch()}
        retrying={forms.isFetching}
      />
    );
  else if (scope === 'all')
    body = forms.data.length ? (
      <RuledList>{forms.data.map(row)}</RuledList>
    ) : (
      <EmptyState title={copy.daftar.belumAda} />
    );
  else {
    const { mine, shared } = splitForms(forms.data);
    body =
      mine.length + shared.length ? (
        (
          [
            ['buatanku', copy.daftar.buatanku, mine],
            ['dibagikan', copy.daftar.dibagikan, shared],
          ] as const
        )
          .filter(([, , list]) => list.length)
          .map(([key, title, list]) => (
            <section key={key} aria-labelledby={`fb-${key}`}>
              <SectionHead title={title} id={`fb-${key}`} />
              <RuledList>{list.map(row)}</RuledList>
            </section>
          ))
      ) : (
        <EmptyState
          title={copy.daftar.belumAda}
          text={copy.daftar.belumAdaIsi}
          action={newForm}
        />
      );
  }

  return (
    <div className="fb">
      <DeskHead title={copy.daftar.judul} actions={newForm} />
      <TopBarActions>{newForm}</TopBarActions>
      <PageBody className="fb-list">
        {admin ? (
          <div>
            <Seg
              label={copy.daftar.tampilkan}
              value={scope}
              onChange={(v) =>
                void navigate({
                  to: '/kelola/form',
                  search: v === 'all' ? { lihat: 'semua' } : {},
                  replace: true,
                })
              }
              options={[
                { value: 'mine', label: copy.daftar.formku },
                { value: 'all', label: copy.daftar.semuaForm },
              ]}
            />
          </div>
        ) : null}
        {body}
      </PageBody>
    </div>
  );
}
