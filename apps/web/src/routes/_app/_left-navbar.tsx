import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/_left-navbar')({
  component: LeftNavbarLayout,
});

function LeftNavbarLayout() {
  return (
    // Today's screens, inside the new shell (P0-C) until their redesign replaces them; the shell owns navigation.
    <div className="flex h-full flex-auto flex-col overflow-x-hidden lg:block">
      <Outlet />
    </div>
  );
}
