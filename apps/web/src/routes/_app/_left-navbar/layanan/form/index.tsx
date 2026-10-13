import { createFileRoute } from '@tanstack/react-router';
import { formListQuery, prefetch } from '~/api/queries';
import { FormList } from '~/components/form/FormList';

export const Route = createFileRoute('/_app/_left-navbar/layanan/form/')({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => prefetch(formListQuery()),
  component: FormList,
});
