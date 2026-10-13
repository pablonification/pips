import { createFileRoute } from '@tanstack/react-router';
import { prefetch } from '~/api/queries';
import { TestiListScreen } from '~/features/testi/TestiScreens';
import { catalogueQuery } from '~/features/testi/queries';
import { querySearchSchema } from '~/lib/search-params';

export const Route = createFileRoute(
  '/_app/_left-navbar/layanan/testi/$type/$semester/',
)({
  loader: () => prefetch(catalogueQuery()),
  component: TestiListScreen,
  // `q`: the list's own search, kept by Back and reload.
  validateSearch: (search) => querySearchSchema.parse(search),
});
