import { createFileRoute } from '@tanstack/react-router';
import { ClaimScreen } from '~/features/tautan/ClaimScreen';

export const Route = createFileRoute('/_app/_left-navbar/layanan/tautan/ambil')(
  { component: ClaimScreen },
);
