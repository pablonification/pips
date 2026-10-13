import { createFileRoute } from '@tanstack/react-router';
import { currentCoursesQuery, prefetch } from '~/api/queries';
import { MulaiScreen } from '~/features/masuk/MulaiScreen';

/** First run (P1-C): after a sign-in with no shared link, while a step is open. A focused flow inside the shell. */
export const Route = createFileRoute('/_app/mulai')({
  loader: () => prefetch(currentCoursesQuery()),
  component: MulaiScreen,
});
