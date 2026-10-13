import { createFileRoute } from '@tanstack/react-router';
import { NotifikasiScreen } from '~/features/profil/NotifikasiScreen';

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/notifikasi/',
)({
  component: NotifikasiScreen,
});
