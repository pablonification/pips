import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/_left-navbar')({
  component: LeftNavbarLayout,
});

function LeftNavbarLayout() {
  return (
    // Today's screens, inside the new shell (P0-C) until their redesign replaces them; the shell owns navigation.
    // `g-page-wrap` clips sideways with `clip`, not `hidden`: hidden made this a second scrolling box inside the
    // shell's, so a sticky composer (Curhat's chat bar) stuck to this box instead of the window (P2-C).
    <div className="g-page-wrap flex h-full flex-auto flex-col lg:block">
      <Outlet />
    </div>
  );
}
