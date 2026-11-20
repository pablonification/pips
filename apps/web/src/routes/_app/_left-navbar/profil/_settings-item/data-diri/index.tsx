import { createFileRoute } from '@tanstack/react-router';
import { prefetch } from '~/api/queries';
import { DataDiriScreen } from '~/features/form/DataDiriScreen';
import { myDetailsQuery } from '~/features/form/queries';

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/data-diri/',
)({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => prefetch(myDetailsQuery()),
  component: DataDiriScreen,
});
