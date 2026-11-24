import { createFileRoute } from '@tanstack/react-router';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { AdminScreen } from '~/features/tautan/AdminScreen';

export const Route = createFileRoute('/_app/_left-navbar/kelola/tautan/')({
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <KelolaGate page="tautan">
      <AdminScreen />
    </KelolaGate>
  );
}
