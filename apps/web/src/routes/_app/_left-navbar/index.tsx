import { createFileRoute } from '@tanstack/react-router';
import { calendarEventsQuery, prefetch } from '~/api/queries';
import { BerandaScreen } from '~/features/beranda/BerandaScreen';
import { stripMonths } from '~/features/kalender/rules';
import { berandaSearchSchema } from '~/lib/search-params';

export const Route = createFileRoute('/_app/_left-navbar/')({
  validateSearch: (search) => berandaSearchSchema.parse(search),
  // The agenda card's months (today and the next seven days), fetched while the page's code downloads.
  loader: () => {
    for (const m of stripMonths(Date.now())) prefetch(calendarEventsQuery(m));
  },
  component: Beranda,
});

function Beranda() {
  const { hari, acara } = Route.useSearch();
  return <BerandaScreen hari={hari} acara={acara} />;
}
