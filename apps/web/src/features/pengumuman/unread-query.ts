/** The unread count's query, for the feed's chip and the shell's badge (see ./unread.ts). */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '~/api/client';
import { unreadInfosQuery } from '~/api/queries';
import { pageUnreadIds, UNREAD_KEY } from './unread';

/** The unread posts' ids (open question 2: paged in the background, capped). Feeds the count everywhere. */
export const useUnreadIds = (enabled = true) => {
  const client = useQueryClient();
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () =>
      pageUnreadIds((offset) =>
        offset === 0
          ? // The first page is Beranda's unread list: one request when both want it, always fresh for the count.
            client.fetchQuery({ ...unreadInfosQuery(), staleTime: 0 })
          : api.info
              .getListInfo({ unread: 'true', offset, sort: 'newest' })
              .then((r) => r.infos),
      ),
    enabled,
  });
};
