import { createFileRoute } from '@tanstack/react-router';
import { NimScreen } from '~/features/nim/NimScreen';
import { querySearchSchema } from '~/lib/search-params';

export const Route = createFileRoute('/_app/_left-navbar/layanan/nim/')({
  component: NimScreen,
  // `q`: the search, so search's "Orang" (P1-A) and any link can open NIM Finder filled in.
  validateSearch: (search) => querySearchSchema.parse(search),
});
