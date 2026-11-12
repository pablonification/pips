import { createFileRoute, redirect } from '@tanstack/react-router';

// Testimonials are added on a Testi Matkul course page, for akademik.
export const Route = createFileRoute('/_app/_left-navbar/kelola/testi')({
  beforeLoad: () => {
    throw redirect({ to: '/layanan/testi', replace: true });
  },
});
