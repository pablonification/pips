import { createFileRoute, Outlet } from '@tanstack/react-router';
import { kalenderRouteSearchSchema } from '~/lib/search-params';

export const Route = createFileRoute('/_app/kalender')({
  // Old links' `selected*` params still parse (P0-B's redirects keep them); the redesign reads `hari` and `acara`.
  component: Outlet,
  validateSearch: (search) => kalenderRouteSearchSchema.parse(search),
});
