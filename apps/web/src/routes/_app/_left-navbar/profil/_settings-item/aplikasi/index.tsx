import { createFileRoute } from '@tanstack/react-router';
import { AplikasiScreen } from '~/features/aplikasi/AplikasiScreen';

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/aplikasi/',
)({
  component: AplikasiScreen,
});
