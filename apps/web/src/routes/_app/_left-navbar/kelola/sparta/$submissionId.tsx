import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { prefetch } from '~/api/queries';
import { spartaDepartmentsQuery } from '~/components/form/sparta-data';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { mayLoad, spartaSubmissionByIdQuery } from '~/features/kelola/queries';
import { SpartaDetail } from '~/features/kelola/SpartaDetail';

export const Route = createFileRoute(
  '/_app/_left-navbar/kelola/sparta/$submissionId',
)({
  loader: ({ params: { submissionId } }) => {
    if (!mayLoad(queryClient, 'sparta')) return;
    prefetch(spartaSubmissionByIdQuery(submissionId));
    prefetch(spartaDepartmentsQuery());
  },
  component: SubmissionRoute,
});

function SubmissionRoute() {
  const { submissionId } = Route.useParams();
  return (
    <KelolaGate page="sparta">
      <SpartaDetail key={submissionId} submissionId={submissionId} />
    </KelolaGate>
  );
}
