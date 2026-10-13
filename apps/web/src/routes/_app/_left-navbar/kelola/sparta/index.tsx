import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { prefetch } from '~/api/queries';
import { spartaDepartmentsQuery } from '~/components/form/sparta-data';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { mayLoad, spartaSubmissionsQuery } from '~/features/kelola/queries';
import { SpartaScreen } from '~/features/kelola/SpartaScreen';
import { spartaDataSearchSchema } from '~/lib/search-params';

export const Route = createFileRoute('/_app/_left-navbar/kelola/sparta/')({
  validateSearch: (search) => spartaDataSearchSchema.parse(search),
  loader: () => {
    if (!mayLoad(queryClient, 'sparta')) return;
    prefetch(spartaDepartmentsQuery());
    prefetch(spartaSubmissionsQuery());
  },
  component: SpartaRoute,
});

function SpartaRoute() {
  const filters = Route.useSearch();
  return (
    <KelolaGate page="sparta">
      <SpartaScreen filters={filters} />
    </KelolaGate>
  );
}
