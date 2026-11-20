import { createFileRoute } from '@tanstack/react-router';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { PreviewScreen } from '~/features/kelola-form/PreviewScreen';
import { loadFormIsi } from '~/features/form/load';
import { loadFormsData } from '~/features/kelola-form/load';

// The member's form as its maker sees it before sending it out: nothing is sent.
export const Route = createFileRoute(
  '/_app/_left-navbar/kelola/form/$formId/pratinjau',
)({
  loader: ({ params: { formId } }) =>
    void loadFormsData().then((d) => d.startForm(formId, loadFormIsi)),
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
