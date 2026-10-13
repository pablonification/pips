import { Outlet, createFileRoute } from '@tanstack/react-router';

/** A pathless group for Profil's pages (P1-C); today's settings frame around them is gone. */
export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item',
)({
  component: Outlet,
});
