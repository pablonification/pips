import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { prefetch } from '~/api/queries';
import { formDetailQuery } from '~/components/form/data';
import { KelolaGate } from '~/features/kelola/KelolaGate';
import { LiveScreen } from '~/features/kelola/LiveScreen';
import {
  formAnalyticsQuery,
  formResponsesCountQuery,
  latestResponsesQuery,
  mayLoad,
} from '~/features/kelola/queries';

export const Route = createFileRoute('/_app/_left-navbar/kelola/live/$formId/')(
  {
    loader: ({ params: { formId } }) => {
      if (!mayLoad(queryClient, 'live')) return;
      prefetch(formDetailQuery(formId));
      prefetch(formResponsesCountQuery(formId));
      prefetch(latestResponsesQuery(formId));
      prefetch(formAnalyticsQuery(formId));
    },
    component: LiveRoute,
  },
);

function LiveRoute() {
  const { formId } = Route.useParams();
  return (
    <KelolaGate page="live">
      <LiveScreen key={formId} formId={formId} />
    </KelolaGate>
  );
}
