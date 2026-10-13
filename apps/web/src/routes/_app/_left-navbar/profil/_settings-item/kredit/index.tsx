import { createFileRoute } from '@tanstack/react-router';
import { creditsQuery, prefetch } from '~/api/queries';
import { KreditScreen } from '~/features/profil/KreditScreen';

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/kredit/',
)({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => prefetch(creditsQuery()),
  component: KreditScreen,
});
