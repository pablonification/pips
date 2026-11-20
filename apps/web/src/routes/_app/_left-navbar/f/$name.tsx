import { createFileRoute } from '@tanstack/react-router';
import { prefetch } from '~/api/queries';
import { FormLinkScreen } from '~/features/form/FormLinkScreen';
import { formLinkQuery } from '~/features/form/queries';

export const Route = createFileRoute('/_app/_left-navbar/f/$name')({
  loader: ({ params }) => prefetch(formLinkQuery(params.name)),
  component: FormLinkRoute,
});

function FormLinkRoute() {
  const { name } = Route.useParams();
  return <FormLinkScreen key={name} name={name} />;
}
