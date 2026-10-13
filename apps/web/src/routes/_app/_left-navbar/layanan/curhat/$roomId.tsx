import { createFileRoute } from '@tanstack/react-router';
import { chatroomsQuery, prefetch } from '~/api/queries';
import { RoomScreen } from '~/features/curhat/Room';

// A room comes from the rooms list: there is no per-room endpoint (P2-C).
export const Route = createFileRoute(
  '/_app/_left-navbar/layanan/curhat/$roomId',
)({
  loader: () => prefetch(chatroomsQuery()),
  component: RoomScreen,
});
