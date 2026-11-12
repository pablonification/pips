import { Outlet, createFileRoute } from '@tanstack/react-router';

/** A pathless group for Profil's pages. */
export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item',
)({
  component: Outlet,
});
