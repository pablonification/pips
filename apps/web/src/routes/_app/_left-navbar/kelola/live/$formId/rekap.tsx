import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { prefetch } from '~/api/queries';
import { formDetailQuery } from '~/components/form/data';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { mayLoad, responsesPageQuery } from '~/features/kelola/queries';
import { RekapScreen } from '~/features/kelola/RekapScreen';
import { rekapSearchSchema } from '~/lib/search-params';

export const Route = createFileRoute(
  '/_app/_left-navbar/kelola/live/$formId/rekap',
)({
  validateSearch: (search) => rekapSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    q: search.q ?? '',
    halaman: search.halaman ?? 1,
  }),
  loader: ({ params: { formId }, deps }) => {
    if (!mayLoad(queryClient, 'live')) return;
    prefetch(formDetailQuery(formId));
    prefetch(responsesPageQuery(formId, deps.halaman, deps.q));
  },
  component: RekapRoute,
});

function RekapRoute() {
  const { formId } = Route.useParams();
  const { q, halaman } = Route.useSearch();
  return (
    <KelolaGate page="live">
      <RekapScreen formId={formId} q={q} halaman={halaman} />
    </KelolaGate>
  );
}
