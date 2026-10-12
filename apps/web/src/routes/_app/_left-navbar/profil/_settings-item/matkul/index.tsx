import { createFileRoute } from '@tanstack/react-router';
import MyCourses from './-components/MyCourses';

function Courses() {
  return <MyCourses />;
}

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/matkul/',
)({
  component: Courses,
});
