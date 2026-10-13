/**
 * Tambah acara (brief rule 12), for `akademik` or `ring1` only. P3-B builds the new add-event dialog; until then the
 * button opens today's AddEventDialog (desktop) or AddEventDrawer (phones and tablets) unchanged, on their old light
 * surface, with today's category choice: a member with both roles picks Himpunan or Akademik first.
 */
import { lazy, Suspense, useRef, useState } from 'react';
import type { CalendarCategory } from '~/api/generated';
import {
  Button,
  DESKTOP_QUERY,
  Menu,
  MenuItem,
  useMediaQuery,
} from '~/components/garis';
import { IconTambah } from '~/components/icons/tambah';
import { LegacyScreen } from '~/components/shell/page';
import { kalender as t } from '~/copy/kalender';
import useSession from '~/hooks/auth/useSession';
import { can } from '~/lib/capabilities';

const AddEventDialog = lazy(
  () => import('~/routes/_app/kalender/-components/AddEventDialog'),
);
const AddEventDrawer = lazy(
  () => import('~/routes/_app/kalender/-components/AddEventDrawer'),
);

export function AddEventButton() {
  const user = useSession();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const [category, setCategory] = useState<CalendarCategory | null>(null);
  const constraint = useRef<HTMLElement | null>(null);
  const akademik = can(user, 'createAkademikEvent');
  const himpunan = can(user, 'createHimpunanEvent');
  if (!akademik && !himpunan) return null;

  const trigger = (
    <Button
      variant="gold"
      size="sm"
      onClick={
        akademik && himpunan
          ? undefined
          : () => setCategory(akademik ? 'akademik' : 'himpunan')
      }
    >
      <IconTambah size={16} />
      {t.tambahAcara}
    </Button>
  );
  const open = (o: boolean) => {
    if (!o) setCategory(null);
  };
  // Today's desktop dialog keeps itself inside the page area (its drag constraint).
  constraint.current = document.getElementById('isi');

  return (
    <>
      {akademik && himpunan ? (
        <Menu trigger={trigger}>
          <MenuItem onSelect={() => setCategory('himpunan')}>
            {t.legenda.himpunan}
          </MenuItem>
          <MenuItem onSelect={() => setCategory('akademik')}>
            {t.legenda.akademik}
          </MenuItem>
        </Menu>
      ) : (
        trigger
      )}
      {category ? (
        <LegacyScreen className="contents">
          <Suspense fallback={null}>
            {desk ? (
              <AddEventDialog
                isOpen
                setOpen={(v) => open(typeof v === 'function' ? v(true) : v)}
                constraintRef={constraint}
                category={category}
              />
            ) : (
              <AddEventDrawer
                isOpen
                setOpen={(v) => open(typeof v === 'function' ? v(true) : v)}
                category={category}
              />
            )}
          </Suspense>
        </LegacyScreen>
      ) : null}
    </>
  );
}
