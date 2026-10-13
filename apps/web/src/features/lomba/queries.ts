import { api } from '~/api/client';
import type { Competition } from '~/api/generated';
import { nextOffset } from './rules';

/**
 * Open competitions, soonest deadline first, 10 a page (the API's order and size). Under today's `competitions`
 * key, so adding a competition (P3-B) refreshes this list too.
 */
export const competitionsQuery = {
  queryKey: ['competitions', 'deadline'] as const,
  queryFn: ({ pageParam }: { pageParam: number }) =>
    api.competitions
      .getCompetitionList({ sort: 'deadline', offset: pageParam })
      .then((r) => r.competitions),
  initialPageParam: 0,
  getNextPageParam: (_last: Competition[], pages: Competition[][]) =>
    nextOffset(pages),
};
