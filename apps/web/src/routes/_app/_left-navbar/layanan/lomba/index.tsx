import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { ME_QUERY_KEY } from '~/api/constants';
import { LombaScreen } from '~/features/lomba/LombaScreen';
import { competitionsQuery } from '~/features/lomba/queries';

export const Route = createFileRoute('/_app/_left-navbar/layanan/lomba/')({
  // The first page, fetched while the page's code downloads (once a member is known, as P0-B's `prefetch`).
  loader: () => {
    if (queryClient.getQueryData([ME_QUERY_KEY]))
      void queryClient.prefetchInfiniteQuery(competitionsQuery);
  },
  component: LombaScreen,
});
