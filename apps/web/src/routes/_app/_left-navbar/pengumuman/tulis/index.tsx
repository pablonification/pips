import { createFileRoute } from '@tanstack/react-router';
import {
  composerOpened,
  resetComposer,
} from '~/features/pengumuman/compose-store';
import { ComposeScreen } from '~/features/pengumuman/screens';
import { deleteSharedData } from '~/lib/share-db';

export const Route = createFileRoute('/_app/_left-navbar/pengumuman/tulis/')({
  component: ComposeScreen,
  // The prototype starts each announcement fresh (open question 4); what the share target handed over is cleared
  // once the composer is left.
  onEnter: () => composerOpened(),
  onLeave() {
    resetComposer();
    void deleteSharedData();
  },
});
