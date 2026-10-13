/**
 * A room's options (`menuBtn`, `menuList`): one item, Sematkan ruang or Lepas sematan (today's row menu has Pin and
 * Unpin). The Garis set has no pin icon, so the item has none. Busy while its request runs, so it can't send twice;
 * a failure says what happened without signing anyone out, and a 401 re-checks the session (`useRoleLoss`), so a
 * role taken away sends the member on.
 */
import { useQueryClient } from '@tanstack/react-query';
import type { Chatroom } from '~/api/generated';
import { IconButton, Menu, MenuItem, toast } from '~/components/garis';
import { IconLainnya } from '~/components/icons/lainnya';
import { fill } from '~/copy/fill';
import { kelolaCurhat as t } from '~/copy/kelola-curhat';
import { useRoleLoss } from '~/features/kelola/KelolaGate';
import { roomName } from '~/features/curhat/rules';
import { setPinned, statusOf, usePinRoom } from './data';
import { writeFailure } from './rules';

export function PinMenu({
  room,
  size = 'sm',
}: {
  room: Chatroom;
  size?: 'sm' | 'md';
}) {
  const qc = useQueryClient();
  const pin = usePinRoom();
  useRoleLoss(pin.error);
  const pinned = room.isPinned === true;
  const busy = pin.isPending;

  const toggle = () => {
    if (busy) return;
    const isPinned = !pinned;
    pin.mutate(
      { chatroomId: room.id, isPinned },
      {
        onSuccess: () => {
          setPinned(qc, room.id, isPinned);
          toast.success(isPinned ? t.sematan.disematkan : t.sematan.dilepas);
        },
        onError: (e) => toast.error(t.sematan[writeFailure(statusOf(e))]),
      },
    );
  };

  return (
    <Menu
      trigger={
        <IconButton
          label={fill(t.sematan.opsi, { nama: roomName(room.title) })}
          size={size}
          aria-busy={busy || undefined}
        >
          <IconLainnya size={20} />
        </IconButton>
      }
    >
      <MenuItem disabled={busy} onSelect={toggle}>
        {pinned ? t.sematan.lepas : t.sematan.sematkan}
      </MenuItem>
    </Menu>
  );
}
