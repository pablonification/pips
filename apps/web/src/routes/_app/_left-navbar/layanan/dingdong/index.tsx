import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { currentCoursesQuery } from '~/api/queries';
import MobileView from './-components/mobile-view';
import DesktopView from './-components/desktop-view';
// import MyCourses from './-components/MyCourses';

export const Route = createFileRoute('/_app/_left-navbar/layanan/dingdong/')({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => void queryClient.prefetchQuery(currentCoursesQuery()),
  component: Dingdong,
});

function Dingdong() {
  return (
    <>
      {/* Show mobile view if the window size <= lg */}
      <MobileView />

      {/* Show desktop view if the window size > lg */}
      <DesktopView />
    </>
  );
}
