/** The unread count's query, for the feed's chip and the shell's badge (see ./unread.ts). */
import { useQuery } from '@tanstack/react-query';
import { api } from '~/api/client';
import { pageUnreadIds, UNREAD_KEY } from './unread';

/** The unread posts' ids (open question 2: paged in the background, capped). Feeds the count everywhere. */
export const useUnreadIds = (enabled = true) =>
  useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () =>
      pageUnreadIds((offset) =>
        api.info
          .getListInfo({ unread: 'true', offset, sort: 'newest' })
          .then((r) => r.infos),
      ),
    enabled,
  });
