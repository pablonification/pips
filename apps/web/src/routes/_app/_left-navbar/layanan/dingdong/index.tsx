import { createFileRoute } from '@tanstack/react-router';
import { currentCoursesQuery, prefetch } from '~/api/queries';
import MobileView from './-components/mobile-view';
import DesktopView from './-components/desktop-view';
// import MyCourses from './-components/MyCourses';

export const Route = createFileRoute('/_app/_left-navbar/layanan/dingdong/')({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => prefetch(currentCoursesQuery()),
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
