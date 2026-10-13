import { createFileRoute } from '@tanstack/react-router';
import { prefetch } from '~/api/queries';
import { TestiStartScreen } from '~/features/testi/TestiScreens';
import { catalogueQuery } from '~/features/testi/queries';
import { querySearchSchema } from '~/lib/search-params';

export const Route = createFileRoute('/_app/_left-navbar/layanan/testi/')({
  // The catalogue, for the search, while the page's code downloads.
  loader: () => prefetch(catalogueQuery()),
  component: TestiStartScreen,
  validateSearch: (search) => querySearchSchema.parse(search),
});
