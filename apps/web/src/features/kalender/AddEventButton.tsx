/**
 * Tambah acara (`addEvBtn`), for `akademik` or `ring1` only. It opens P3-B's add-event dialog
 * (`/kalender?tambah=acara`), where a member with both roles chooses Akademik or Himpunan.
 */
import { Button } from '~/components/garis';
import { IconTambah } from '~/components/icons/tambah';
import { kalender as t } from '~/copy/kalender';
import useSession from '~/hooks/auth/useSession';
import { canCreateEvent } from '~/lib/capabilities';
import { useOpenAddEvent } from '~/features/kelola-acara/AddEvent';

export function AddEventButton() {
  const user = useSession();
  const open = useOpenAddEvent();
  if (!canCreateEvent(user)) return null;
  return (
    <Button variant="gold" size="sm" onClick={open}>
      <IconTambah size={16} />
      {t.tambahAcara}
    </Button>
  );
}
