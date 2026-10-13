import { createFileRoute } from '@tanstack/react-router';
import { prefetch } from '~/api/queries';
import { spartaWindowQuery } from '~/components/form/sparta-data';
import { Sparta } from '~/components/form/Sparta';

export const Route = createFileRoute('/_app/_left-navbar/layanan/sparta/')({
  // The window first: it says whether the rest is for this member.
  loader: () => prefetch(spartaWindowQuery()),
  component: Sparta,
});
