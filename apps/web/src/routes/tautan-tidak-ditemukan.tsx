import { createFileRoute } from '@tanstack/react-router';
import { object, string } from '~/lib/params';
import { NotFoundPage } from '~/features/tautan/NotFoundPage';

// Where s.hmif.dev sends a name no link has: no sign-in, no app around it.
const search = object({ nama: string });

export const Route = createFileRoute('/tautan-tidak-ditemukan')({
  validateSearch: (s) => search.parse(s),
  component: NotFoundRoute,
});

function NotFoundRoute() {
  const { nama } = Route.useSearch();
  return <NotFoundPage name={nama ?? ''} />;
}
