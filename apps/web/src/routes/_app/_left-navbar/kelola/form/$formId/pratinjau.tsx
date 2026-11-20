import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { prefetch } from '~/api/queries';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { PreviewScreen } from '~/features/kelola-form/PreviewScreen';
import { manageFormQuery, mayLoadForms } from '~/features/kelola-form/data';

// The member's form as its maker sees it before sending it out: nothing is sent.
export const Route = createFileRoute(
  '/_app/_left-navbar/kelola/form/$formId/pratinjau',
)({
  loader: ({ params: { formId } }) => {
    if (mayLoadForms(queryClient)) prefetch(manageFormQuery(formId));
  },
  component: PreviewRoute,
});

function PreviewRoute() {
  const { formId } = Route.useParams();
  return (
    <KelolaGate page="form">
      <PreviewScreen formId={formId} />
    </KelolaGate>
  );
}
