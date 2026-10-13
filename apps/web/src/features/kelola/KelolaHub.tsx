import { RuledList } from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import useSession from '~/hooks/auth/useSession';
import { ServiceRow } from '../layanan/ServiceRow';
import { kelolaServices } from './rules';

/**
 * Kelola (garis/screens-more.js `scrKelola`): the registry's Kelola rows this member may use, in its order, with
 * Layanan's own row (tile, name, description, chevron; no badges). Phones and tablets: the top bar's "Kelola" is
 * the heading. Desktop: `deskHead('Kelola')`, one 760 px column.
 */
export function KelolaHub() {
  const me = useSession();
  return (
    <>
      <DeskHead title={common.nav.kelola} />
      <PageBody className="gap-3.5">
        <RuledList>
          {kelolaServices(me).map((s) => (
            <ServiceRow key={s.id} service={s} />
          ))}
        </RuledList>
      </PageBody>
    </>
  );
}
