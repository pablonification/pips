import { createFileRoute } from '@tanstack/react-router';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { KelolaHub } from '~/features/kelola/KelolaHub';

export const Route = createFileRoute('/_app/_left-navbar/kelola/')({
  component: KelolaRoute,
});

function KelolaRoute() {
  return (
    <KelolaGate page="hub">
      <KelolaHub />
    </KelolaGate>
  );
}
