import { createFileRoute } from '@tanstack/react-router';
import { chatroomsQuery, prefetch } from '~/api/queries';
import { CurhatList } from '~/features/curhat/List';

// Welfare is sent on to the inbox by the area's layout (P3-C), so this is the members' list only.
export const Route = createFileRoute('/_app/_left-navbar/layanan/curhat/')({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => prefetch(chatroomsQuery()),
  component: CurhatList,
});
