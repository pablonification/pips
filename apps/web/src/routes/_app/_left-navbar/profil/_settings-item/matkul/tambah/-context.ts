import { createContext, Dispatch, SetStateAction } from 'react';

// Shared by the add-course page and its course items; outside the route file so the route's code can be split.
export interface TakeCourseBody {
  courseId: string;
  class: number;
}

export const CourseContext = createContext<{
  selectedCourses: TakeCourseBody[];
  setSelectedCourses: Dispatch<SetStateAction<TakeCourseBody[]>>;
}>({
  selectedCourses: [],
  setSelectedCourses: (() => {}) as Dispatch<SetStateAction<TakeCourseBody[]>>,
});
