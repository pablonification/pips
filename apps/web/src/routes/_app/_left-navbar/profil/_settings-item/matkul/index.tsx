import { createFileRoute } from '@tanstack/react-router';
import { currentCoursesQuery, prefetch } from '~/api/queries';
import { MatkulScreen } from '~/features/profil/MatkulScreen';

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/matkul/',
)({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => prefetch(currentCoursesQuery()),
  component: MatkulScreen,
});
