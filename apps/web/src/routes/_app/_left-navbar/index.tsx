import { createFileRoute } from '@tanstack/react-router';
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
  component: MainDashboard,
});
