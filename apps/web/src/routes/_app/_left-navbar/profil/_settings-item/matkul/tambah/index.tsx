import { createFileRoute } from '@tanstack/react-router';
import { MatkulTambahScreen } from '~/features/profil/MatkulTambahScreen';
import { matkulTambahSearchSchema } from '~/lib/search-params';

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/matkul/tambah/',
)({
  validateSearch: (search) => matkulTambahSearchSchema.parse(search),
  component: TambahPage,
});

function TambahPage() {
  const { dari } = Route.useSearch();
  return <MatkulTambahScreen fromFirstRun={dari === 'mulai'} />;
}
