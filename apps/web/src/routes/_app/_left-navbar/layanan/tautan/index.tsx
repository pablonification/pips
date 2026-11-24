import { createFileRoute } from '@tanstack/react-router';
import { object, string } from '~/lib/params';
import { TautanScreen } from '~/features/tautan/TautanScreen';

// `buat`: open "Buat tautan pendek" over the list (global search's action).
const search = object({ buat: string });

export const Route = createFileRoute('/_app/_left-navbar/layanan/tautan/')({
  validateSearch: (s) => search.parse(s),
  component: TautanRoute,
});

function TautanRoute() {
  const { buat } = Route.useSearch();
  return <TautanScreen startMaking={buat === 'tautan'} />;
}
