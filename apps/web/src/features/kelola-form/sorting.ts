import type { Announcements, Modifier } from '@dnd-kit/core';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';

/** Items move only up and down. */
export const verticalOnly: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

/**
 * What a screen reader hears while a list is reordered with the keyboard (Space or Enter lifts, the arrows move,
 * Space or Enter drops, Escape puts it back), in Indonesian. `place` gives an item's position, from 1, among `count`.
 */
export function sortAnnouncements(
  count: number,
  place: (id: string) => number = () => 0,
): {
  announcements: Announcements;
  screenReaderInstructions: { draggable: string };
} {
  return {
    screenReaderInstructions: { draggable: copy.susunUlang.petunjuk },
    announcements: {
      onDragStart: () => copy.susunUlang.diangkat,
      onDragOver: ({ over }) =>
        over
          ? fill(copy.susunUlang.posisi, {
              nomor: place(String(over.id)) || 1,
              jumlah: count,
            })
          : undefined,
      onDragEnd: () => copy.susunUlang.diletakkan,
      onDragCancel: () => copy.susunUlang.dibatalkan,
    },
  };
}
