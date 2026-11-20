import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { prefetch } from '~/api/queries';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { FormsScreen } from '~/features/kelola-form/FormsScreen';
import { managedFormsQuery, mayLoadForms } from '~/features/kelola-form/data';
import { kelolaFormSearchSchema } from '~/lib/search-params';

// Kelola › Form: any pengurus. `lihat=semua` is admin's Semua form; the screen falls back to theirs for anyone else.
export const Route = createFileRoute('/_app/_left-navbar/kelola/form/')({
  validateSearch: (search) => kelolaFormSearchSchema.parse(search),
  loader: () => {
    if (mayLoadForms(queryClient)) prefetch(managedFormsQuery('mine'));
  },
  component: FormsRoute,
});

function FormsRoute() {
  const { lihat } = Route.useSearch();
  return (
    <KelolaGate page="form">
      <FormsScreen all={lihat === 'semua'} />
    </KelolaGate>
  );
}
