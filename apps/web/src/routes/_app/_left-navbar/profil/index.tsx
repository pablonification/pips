import { createFileRoute } from '@tanstack/react-router';
import { ProfilScreen } from '~/features/profil/ProfilScreen';

export const Route = createFileRoute('/_app/_left-navbar/profil/')({
  component: ProfilScreen,
});
