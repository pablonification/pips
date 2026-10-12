import { createFileRoute } from '@tanstack/react-router';
import { calendarEventsQuery, monthsAround, prefetch } from '~/api/queries';
import DesktopView from './-home/desktop-view';
import MobileView from './-home/mobile-view';

function MainDashboard() {
  return (
    <>
      {/* Show mobile view if the window size <= lg */}
      <MobileView />

      {/* Show desktop view if the window size > lg */}
      <DesktopView />
    </>
  );
}

export const Route = createFileRoute('/_app/_left-navbar/')({
  // Today's agenda: the months the strip of today ±3 days touches, fetched while the page's code downloads.
  loader: () => {
    for (const m of monthsAround(new Date(), 3, 3)) {
      prefetch(calendarEventsQuery(m));
    }
  },
  component: MainDashboard,
});
