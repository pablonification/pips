import { createFileRoute } from '@tanstack/react-router';
import { calendarEventsQuery, monthsAround, prefetch } from '~/api/queries';
import { BerandaHome } from '~/components/shell/BerandaHome';
import { LegacyScreen } from '~/components/shell/page';
import DesktopView from './-home/desktop-view';
import MobileView from './-home/mobile-view';

function MainDashboard() {
  return (
    // The shell's Beranda frame (P0-C) around today's Home, on its old surface, until P1-A replaces it.
    <BerandaHome>
      <LegacyScreen className="flex-1">
        {/* Show mobile view if the window size <= lg */}
        <MobileView />

        {/* Show desktop view if the window size > lg */}
        <DesktopView />
      </LegacyScreen>
    </BerandaHome>
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
