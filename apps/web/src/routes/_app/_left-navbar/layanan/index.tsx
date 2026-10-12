import { createFileRoute } from '@tanstack/react-router';
import { RoutePlaceholder } from '~/components/route-placeholder';
import { common } from '~/copy/common';

export const Route = createFileRoute('/_app/_left-navbar/layanan/')({
  component: () => <RoutePlaceholder title={common.nav.layanan} />,
});
