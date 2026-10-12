import { createFileRoute, Outlet } from '@tanstack/react-router';
import CalendarNavbar from '~/components/navbar/CalendarNavbar';
import { kalenderRouteSearchSchema } from '~/lib/search-params';

export const Route = createFileRoute('/_app/kalender')({
  component: CalendarLayout,
  validateSearch: (search) => kalenderRouteSearchSchema.parse(search),
});

function CalendarLayout() {
  return (
    <>
      <CalendarNavbar />
      <div className="flex h-full flex-1 flex-col lg:block">
        <Outlet />
      </div>
    </>
  );
}
