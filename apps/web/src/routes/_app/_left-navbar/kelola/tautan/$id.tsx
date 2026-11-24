import { createFileRoute } from '@tanstack/react-router';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { LinkScreen } from '~/features/tautan/LinkScreen';

// A link as admin sees it from Kelola: its owner or old account, with Berikan ke anggota or Pindahkan.
export const Route = createFileRoute('/_app/_left-navbar/kelola/tautan/$id')({
  component: AdminLinkRoute,
});

function AdminLinkRoute() {
  const { id } = Route.useParams();
  return (
    <KelolaGate page="tautan">
      <LinkScreen id={id} admin />
    </KelolaGate>
  );
}
