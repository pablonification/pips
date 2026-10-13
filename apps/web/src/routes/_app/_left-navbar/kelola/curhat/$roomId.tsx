import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { chatroomsQuery, prefetch } from '~/api/queries';
import { InboxRoomScreen } from '~/features/curhat-inbox/InboxRoom';
import { mayLoad } from '~/features/kelola/queries';

// A room comes from the rooms list: there is no per-room endpoint (P2-C).
export const Route = createFileRoute(
  '/_app/_left-navbar/kelola/curhat/$roomId',
)({
  loader: () => {
    if (mayLoad(queryClient, 'curhat')) prefetch(chatroomsQuery());
  },
  component: InboxRoomScreen,
});
