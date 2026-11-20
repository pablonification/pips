import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from '@tanstack/react-router';
import { Button, ErrorState } from '~/components/garis';
import { IconGrup } from '~/components/icons/grup';
import { IconKelola } from '~/components/icons/kelola';
import { IconKredit } from '~/components/icons/kredit';
import { IconTautan } from '~/components/icons/tautan';
import { useCover } from '~/components/shell/cover';
import { DeskHead, PageBody, usePageTitle } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { isi } from '~/copy/isi';
import { formLinkQuery } from './queries';
import { audienceText } from './rules';
import { Body, Cover, FormState, Loading, ToList } from './parts';
import './form.css';

/** The address a form's link shows, as the member reads it. */
export const LINK_BASE = 'app.hmif.dev/f/';

/**
 * Opening a form's link, `/f/<name>` (signed out, Masuk comes first and brings the member back here). A form for
 * the member opens as from Layanan › Form; a form for another angkatan shows its title and who it is for, nothing
 * more; a draft shows only to those who manage it; a name no form has is "Form tidak ditemukan".
 */
export function FormLinkScreen({ name }: { name: string }) {
  const link = useQuery(formLinkQuery(name));
  const k = isi.keadaan;
  if (link.data && link.data.state === 'form')
    return (
      <Navigate
        to="/layanan/form/$formId"
        params={{ formId: link.data.formId }}
        replace
      />
    );
  if (link.data)
    return (
      <Covered
        title={link.data.title}
        draft={link.data.state === 'draft'}
        years={link.data.eligibleAngkatan}
        manage={link.data.canManage ? link.data.formId : null}
      />
    );
  if (link.data === null)
    return (
      <>
        <DeskHead title={k.tidakAda} />
        <NotFoundTitle />
        <PageBody>
          <FormState
            icon={<IconTautan size={24} />}
            text={
              <>
                {k.tidakAdaDi}{' '}
                <b className="lk-name">
                  {LINK_BASE}
                  {name}
                </b>
                . {k.tidakAdaSaran}
              </>
            }
          >
            <ToList label={k.formUntukmu} />
          </FormState>
        </PageBody>
      </>
    );
  if (link.isError)
    return (
      <PageBody>
        <ErrorState
          title={k.gagal}
          onRetry={() => void link.refetch()}
          retrying={link.isFetching}
        />
      </PageBody>
    );
  return (
    <PageBody>
      <Loading />
    </PageBody>
  );
}

function NotFoundTitle() {
  usePageTitle(isi.keadaan.tidakAda);
  return null;
}

function Covered({
  title,
  draft,
  years,
  manage,
}: {
  title: string;
  draft: boolean;
  years: number[];
  /** The form's id, when the API says you may manage it: then "Kelola form ini" leads to its builder. */
  manage: string | null;
}) {
  const k = isi.keadaan;
  usePageTitle(title);
  useCover();
  const actions = (
    <>
      {manage ? (
        <Button variant="paper" asChild>
          <Link to="/kelola/form/$formId" params={{ formId: manage }}>
            <IconKelola size={16} />
            {k.kelolaFormIni}
          </Link>
        </Button>
      ) : null}
      <ToList label={k.formUntukmu} variant={manage ? 'ghost' : 'paper'} />
    </>
  );
  return (
    <div className="g-fx">
      <Cover title={title} />
      <Body>
        {!draft ? (
          <FormState
            icon={<IconGrup size={24} />}
            title={k.bukanUntukmu}
            text={fill(k.yangBisa, {
              angkatan: audienceText(years),
            })}
          >
            {actions}
          </FormState>
        ) : (
          <FormState
            icon={<IconKredit size={24} />}
            title={k.draf}
            text={k.drafIsi}
          >
            {actions}
          </FormState>
        )}
      </Body>
    </div>
  );
}
