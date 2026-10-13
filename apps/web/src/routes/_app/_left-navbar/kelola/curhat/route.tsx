import { createFileRoute } from '@tanstack/react-router';
import { InboxArea } from '~/features/curhat-inbox/Area';
import { KelolaGate } from '~/features/kelola/KelolaGate';

// P3-C: Welfare's inbox. The gate lets only `curhatadmin` in before anything opens a connection; the area owns the
// one connection for the list and its rooms, closed when you leave.
export const Route = createFileRoute('/_app/_left-navbar/kelola/curhat')({
  component: InboxRoute,
});

function InboxRoute() {
  return (
    <KelolaGate page="curhat">
      <InboxArea />
    </KelolaGate>
  );
}
