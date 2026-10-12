import { createFileRoute } from '@tanstack/react-router';
import { RoutePlaceholder } from '~/components/route-placeholder';
import { serviceById } from '~/lib/services';

export const Route = createFileRoute(
  '/_app/_left-navbar/layanan/curhat/$roomId',
)({
  component: () => <RoutePlaceholder title={serviceById('curhat').label} />,
});
