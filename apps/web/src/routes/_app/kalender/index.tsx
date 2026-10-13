import { createFileRoute } from '@tanstack/react-router';
import { calendarEventsQuery, prefetch } from '~/api/queries';
import { KalenderScreen } from '~/features/kalender/KalenderScreen';
import { gridMonths } from '~/features/kalender/rules';
import { dayKeyOf, monthOf } from '~/lib/days';

export const Route = createFileRoute('/_app/kalender/')({
  // The months the chosen day's grid shows (its outside days too), fetched while the page's code downloads.
  loaderDeps: ({ search }) => ({ hari: search.hari }),
  loader: ({ deps }) => {
    for (const m of gridMonths(monthOf(deps.hari ?? dayKeyOf(Date.now()))))
      prefetch(calendarEventsQuery(m));
  },
  component: Kalender,
});

function Kalender() {
  const { hari, acara } = Route.useSearch();
  return <KalenderScreen hari={hari} acara={acara} />;
}
