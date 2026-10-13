import { createFileRoute } from '@tanstack/react-router';
import { FeedIndex } from '~/features/pengumuman/screens';

export const Route = createFileRoute('/_app/_left-navbar/pengumuman/')({
  component: FeedIndex,
});
