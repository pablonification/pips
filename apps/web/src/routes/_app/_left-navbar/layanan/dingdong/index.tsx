import { createFileRoute } from '@tanstack/react-router';
import { currentCoursesQuery, prefetch } from '~/api/queries';
import { DingdongScreen } from '~/features/dingdong/DingdongScreen';

export const Route = createFileRoute('/_app/_left-navbar/layanan/dingdong/')({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => prefetch(currentCoursesQuery()),
  component: DingdongScreen,
});
