import { createFileRoute, Outlet } from '@tanstack/react-router';
import { z } from 'zod';
import CalendarNavbar from '~/components/navbar/CalendarNavbar';
import { kalenderSearchSchema } from '~/lib/search-params';

// `hari` and `acara` are the redesign's (P1-A); `selected*` are today's screen's, kept until it is replaced.
const calendarSearchSchema = kalenderSearchSchema.extend({
  selectedDate: z.number().optional(),
  selectedMonth: z.number().optional(),
  selectedYear: z.number().optional(),
});

export const Route = createFileRoute('/_app/kalender')({
  component: CalendarLayout,
  validateSearch: (search) => calendarSearchSchema.parse(search),
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
