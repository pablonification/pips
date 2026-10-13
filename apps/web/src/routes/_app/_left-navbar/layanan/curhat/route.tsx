import { createFileRoute } from '@tanstack/react-router';
import { CurhatArea } from '~/features/curhat/Area';

// The Curhat area: one connection for the list and its rooms, closed when you leave (P2-C).
export const Route = createFileRoute('/_app/_left-navbar/layanan/curhat')({
  component: CurhatArea,
});
