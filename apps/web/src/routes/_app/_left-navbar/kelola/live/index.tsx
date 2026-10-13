import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { prefetch } from '~/api/queries';
import { FormsEntry } from '~/features/kelola/FormsEntry';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { adminFormsQuery, mayLoad } from '~/features/kelola/queries';

export const Route = createFileRoute('/_app/_left-navbar/kelola/live/')({
  // Admin data is asked for only once the cached member may open the page (the guard decides on screen).
  loader: () => {
    if (mayLoad(queryClient, 'live')) prefetch(adminFormsQuery());
  },
  component: FormsRoute,
});

function FormsRoute() {
  return (
    <KelolaGate page="live">
      <FormsEntry />
    </KelolaGate>
  );
}
