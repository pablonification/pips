import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/_left-navbar')({
  component: LeftNavbarLayout,
});

function LeftNavbarLayout() {
  return (
    // Today's screens, inside the new shell (P0-C) until their redesign replaces them; the shell owns navigation.
    // `clip`, not `hidden`: hidden made this a second scrolling box inside the shell's, so a sticky composer (Curhat's
    // chat bar) stuck to this box instead of the window and scrolled away (P2-C).
    <div className="flex h-full flex-auto flex-col overflow-x-clip lg:block">
      <Outlet />
    </div>
  );
}
