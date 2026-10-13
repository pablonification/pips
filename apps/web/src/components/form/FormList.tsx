import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { formListQuery } from '~/api/queries';
import type { FormListItem } from '~/api/generated';
import {
  EmptyState,
  ErrorState,
  OfflineBanner,
  Skeleton,
  SkeletonBlock,
  StatusTag,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { form as copy } from '~/copy/form';
import { fill } from '~/copy/fill';
import { clockWhen, shortWhen } from '~/lib/form/format';
import { statusShown } from '~/lib/form/rules';
import { serviceById } from '~/lib/services';
import { useOnline } from './data';
import '~/styles/garis/form.css';

/** The card's last line: "5 bagian", or when it opens or closed (SPEC story 81; new on cards, OPEN-QUESTIONS D5). */
function caption(f: FormListItem) {
  const shown = statusShown(f.status);
  if (shown === 'soon')
    return fill(copy.daftar.dibuka, { waktu: shortWhen(f.opensAt) });
  if (shown === 'closed' && f.closesAt)
    return fill(copy.daftar.ditutup, { waktu: shortWhen(f.closesAt) });
  return fill(copy.daftar.bagian, { jumlah: f.sectionCount });
}

/**
 * Layanan › Form (garis/screens-more.js `scrForm`): one card per form for your angkatan, in the server's order, each
 * with its status (icon, word, colour), title, description clamped to two lines and "5 bagian".
 */
export function FormList() {
  const list = useQuery(formListQuery());
  const online = useOnline();
  const forms = list.data?.forms;

  let inner;
  if (forms) {
    inner = forms.length ? (
      <ul className="g-form-list">
        {forms.map((f) => (
          <li key={f.id}>
            <Link
              to="/layanan/form/$formId"
              params={{ formId: f.id }}
              className="g-fcard"
            >
              <StatusTag status={statusShown(f.status)} />
              <span className="block t-sub">{f.title}</span>
              {f.description ? (
                <span className="g-clamp2 t-sm text-fg-2">{f.description}</span>
              ) : null}
              <span className="block t-cap text-fg-3">{caption(f)}</span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState
        title={copy.daftar.kosongJudul}
        text={copy.daftar.kosongIsi}
      />
    );
  } else if (list.isError) {
    inner = (
      <ErrorState
        title={copy.daftar.gagal}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    );
  } else {
    inner = (
      <Skeleton label={copy.daftar.memuat}>
        <SkeletonBlock height={150} />
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
