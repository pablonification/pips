import { createFileRoute } from '@tanstack/react-router';
import { formListQuery, prefetch } from '~/api/queries';
import { LayananScreen } from '~/features/layanan/LayananScreen';

export const Route = createFileRoute('/_app/_left-navbar/layanan/')({
  // Form's badge: fetched while the page's code downloads.
  loader: () => prefetch(formListQuery()),
  component: LayananScreen,
});
