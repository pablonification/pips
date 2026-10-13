import { Outlet, createFileRoute } from '@tanstack/react-router';

/*
 * Profil's pages are the redesign's (P1-C) and lay themselves out inside the shell. Today's settings layout and its
 * pieces (-components/settings-*, -config) are left for C1 to delete.
 */
export const Route = createFileRoute('/_app/_left-navbar/profil')({
  component: Outlet,
});
