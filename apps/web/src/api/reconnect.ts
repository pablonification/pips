import type { QueryClient } from '@tanstack/react-query';

/**
 * Back online, a page that failed while offline loads by itself: the queries on screen in their error state are asked
 * again. React Query's own refetch on reconnect misses them when the page opened offline, since it never saw the
 * connection go.
 */
export function refetchFailed(queryClient: QueryClient) {
  return queryClient.refetchQueries({
    type: 'active',
    predicate: (query) => query.state.status === 'error',
  });
}
