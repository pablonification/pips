import { createFileRoute, redirect } from '@tanstack/react-router';

// P3-B: Tambah acara opens over Kalender, where its result shows (the registry's Kelola row points here).
export const Route = createFileRoute('/_app/_left-navbar/kelola/acara')({
  beforeLoad: () => {
    throw redirect({
      to: '/kalender',
      search: { tambah: 'acara' },
      replace: true,
    });
  },
});
