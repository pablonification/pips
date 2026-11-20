import { createFileRoute } from '@tanstack/react-router';
import { HubungkanScreen } from '~/features/aplikasi/HubungkanScreen';
import { consentSearchSchema } from '~/lib/search-params';

/** An app connecting through MCP asks the member here. Signed out, `_app` sends them to sign-in and back. */
export const Route = createFileRoute('/_app/hubungkan')({
  validateSearch: (search) => consentSearchSchema.parse(search),
  component: HubungkanPage,
});

function HubungkanPage() {
  const { permintaan } = Route.useSearch();
  return <HubungkanScreen requestId={permintaan} />;
}
