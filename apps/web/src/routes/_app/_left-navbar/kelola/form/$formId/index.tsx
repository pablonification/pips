import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { prefetch } from '~/api/queries';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { BuilderScreen } from '~/features/kelola-form/BuilderScreen';
import {
  loadBuilder,
  manageFormQuery,
  mayLoadForms,
} from '~/features/kelola-form/data';
import { builderSearchSchema } from '~/lib/search-params';

// A form in the builder. The server decides what the caller may do with it (owner, Edit, Lihat jawaban, admin).
export const Route = createFileRoute('/_app/_left-navbar/kelola/form/$formId/')(
  {
    validateSearch: (search) => builderSearchSchema.parse(search),
    loader: ({ params: { formId } }) => {
      if (!mayLoadForms(queryClient)) return;
      prefetch(manageFormQuery(formId));
      void loadBuilder();
    },
    component: BuilderRoute,
  },
);

function BuilderRoute() {
  const { formId } = Route.useParams();
  const { tab, lihat, no } = Route.useSearch();
  return (
    <KelolaGate page="form">
      <BuilderScreen formId={formId} tab={tab} lihat={lihat} no={no} />
    </KelolaGate>
  );
}
