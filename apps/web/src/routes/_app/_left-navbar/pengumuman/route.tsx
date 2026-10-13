import { createFileRoute } from '@tanstack/react-router';
import { PengumumanLayout } from '~/features/pengumuman/screens';
import { pengumumanSearchSchema } from '~/lib/search-params';

// The feed's view lives here, so the post and the composer keep it (P1-B).
export const Route = createFileRoute('/_app/_left-navbar/pengumuman')({
  validateSearch: (search) => pengumumanSearchSchema.parse(search),
  component: PengumumanLayout,
});
