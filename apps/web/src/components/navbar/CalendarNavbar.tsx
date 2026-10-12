import { getRouteApi } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { useState } from 'react';
import Calendar from '~/components/new-calendar';
import SidebarEvents from './sidebar-events';

const routeApi = getRouteApi('/_app/kalender/');

/** Today's desktop calendar column: the month and the chosen day's events. The shell (P0-C) owns navigation. */
export default function CalendarNavbar() {
  const [currentDate] = useState(dayjs().date());
  const [currentMonth] = useState(dayjs().month());
  const [currentYear] = useState(dayjs().year());

  const { selectedDate, selectedMonth, selectedYear } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const isQueryParamSet =
    selectedDate !== undefined &&
    selectedMonth !== undefined &&
    selectedYear !== undefined;

  const handleMonthChange = (newMonth: number) => {
    if (newMonth < 0) {
      if (isQueryParamSet) {
        navigate({
          search: (prev: {
            selectedDate?: number;
            selectedMonth?: number;
            selectedYear?: number;
          }) => ({
            ...prev,
            selectedYear: selectedYear - 1,
            selectedMonth: 11,
          }),
        });
      } else {
        navigate({
          search: {
            selectedDate: currentDate,
            selectedYear: currentYear - 1,
            selectedMonth: 11,
          },
        });
      }
    } else if (newMonth > 11) {
      if (isQueryParamSet) {
        navigate({
          search: (prev: {
            selectedDate?: number;
            selectedMonth?: number;
            selectedYear?: number;
          }) => ({
            ...prev,
            selectedYear: selectedYear + 1,
            selectedMonth: 0,
          }),
        });
      } else {
        navigate({
          search: {
            selectedDate: currentDate,
            selectedYear: currentYear + 1,
            selectedMonth: 0,
          },
        });
      }
    } else {
      if (isQueryParamSet) {
        navigate({
          search: (prev: {
            selectedDate?: number;
            selectedMonth?: number;
            selectedYear?: number;
          }) => ({
            ...prev,
            selectedMonth: newMonth,
          }),
        });
      } else {
        navigate({
          search: {
            selectedDate: currentDate,
            selectedYear: currentYear,
            selectedMonth: newMonth,
          },
        });
      }
    }
  };

  return (
    <section className="sticky top-0 hidden min-h-full w-[325px] shrink-0 flex-col items-center justify-between border-r border-gray-300 pt-5 lg:flex">
      <div className="-mb-20 w-full">
        <Calendar
          isMobile={false}
          currentMonth={currentMonth}
          currentYear={currentYear}
          onMonthChange={handleMonthChange}
          // The calendar reports its first day on mount: that sync replaces the entry, so Back leaves Kalender.
          onChange={(date) =>
            navigate({
              search: {
                selectedDate: date.getDate(),
                selectedMonth: date.getMonth(),
                selectedYear: date.getFullYear(),
              },
              replace: !isQueryParamSet,
            })
          }
          defaultDate={
            isQueryParamSet
              ? new Date(selectedYear, selectedMonth, selectedDate)
              : new Date(currentYear, currentMonth, currentDate)
          }
          dateClassName="size-6 text-xs"
          dayClassName="text-xs"
        />
        <div className="m-4 flex h-2/5 flex-col gap-2">
          <SidebarEvents
            selectedDate={selectedDate || currentDate}
            selectedMonth={selectedMonth || currentMonth}
            selectedYear={selectedYear || currentYear}
          />
        </div>
      </div>
    </section>
  );
}
