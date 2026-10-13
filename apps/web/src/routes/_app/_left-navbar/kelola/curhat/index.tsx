import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { chatroomsQuery, curhatUnreadQuery, prefetch } from '~/api/queries';
import { InboxList } from '~/features/curhat-inbox/InboxList';
import { mayLoad } from '~/features/kelola/queries';
import { inboxSearchSchema } from '~/lib/search-params';

export const Route = createFileRoute('/_app/_left-navbar/kelola/curhat/')({
  validateSearch: (search) => inboxSearchSchema.parse(search),
  // Fetched while the page's code downloads, once the gate would let them in.
  loader: () => {
    if (!mayLoad(queryClient, 'curhat')) return;
    prefetch(chatroomsQuery());
    prefetch(curhatUnreadQuery());
  },
  component: InboxIndex,
});

function InboxIndex() {
  const view = Route.useSearch();
  return <InboxList view={view} />;
}
