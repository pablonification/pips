import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { calendarEventsQuery } from '~/api/queries';
import DesktopView from './-components/dekstop-view';
import { useState } from 'react';
import dayjs from 'dayjs';
import MobileView from './-components/mobile-view';

export const Route = createFileRoute('/_app/kalender/')({
  // Last, this and next month, as the calendar shows them, fetched while the page's code downloads.
  loader: () => {
    const now = new Date();
    for (const offset of [-1, 0, 1]) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      void queryClient.prefetchQuery(
        calendarEventsQuery({ month: d.getMonth() + 1, year: d.getFullYear() }),
      );
    }
  },
  component: CalendarHome,
});

function CalendarHome() {
  const [currentMonth, setCurrentMonth] = useState(dayjs().month());
  const [currentYear, setCurrentYear] = useState(dayjs().year());

  const handleMonthChange = (newMonth: number) => {
    if (newMonth < 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else if (newMonth > 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(newMonth);
    }
  };

  return (
    <>
      <DesktopView
        currentMonth={currentMonth}
        currentYear={currentYear}
        onMonthChange={handleMonthChange}
      />
      <MobileView />
    </>
  );
}
