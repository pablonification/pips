import { Outlet, createFileRoute } from '@tanstack/react-router';

/*
 * Profil's pages (P1-C) lay themselves out inside the shell; this layout adds nothing of its own.
 */
export const Route = createFileRoute('/_app/_left-navbar/profil')({
  component: Outlet,
});
