import { createFileRoute } from '@tanstack/react-router';
import { deleteSharedData } from '~/lib/share-db';
import { AddAnnouncementPage } from './-components/AddAnnouncementPage';

export const Route = createFileRoute('/_app/_left-navbar/pengumuman/tulis/')({
  component: AddAnnouncementPage,
  onLeave() {
    deleteSharedData();
  },
});
