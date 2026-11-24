import { createFileRoute } from '@tanstack/react-router';
import { LinkScreen } from '~/features/tautan/LinkScreen';

// A link's page; a push about an admin's change opens it too.
export const Route = createFileRoute('/_app/_left-navbar/layanan/tautan/$id')({
  component: LinkRoute,
});

function LinkRoute() {
  const { id } = Route.useParams();
  return <LinkScreen id={id} />;
}
