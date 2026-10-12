import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { currentCoursesQuery } from '~/api/queries';
import MyCourses from './-components/MyCourses';

function Courses() {
  return <MyCourses />;
}

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/matkul/',
)({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => void queryClient.prefetchQuery(currentCoursesQuery()),
  component: Courses,
});
