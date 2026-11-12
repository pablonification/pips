import { createFileRoute, redirect } from '@tanstack/react-router';

// Competitions are managed on Info Lomba itself, for cnc.
export const Route = createFileRoute('/_app/_left-navbar/kelola/lomba')({
  beforeLoad: () => {
    throw redirect({ to: '/layanan/lomba', replace: true });
  },
});
