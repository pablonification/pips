/*
 * Query keys shared across screens: one place, so a write on one screen refreshes the others (and the
 * persisted cache keeps exactly these). Today's screens use the same values; new code imports these.
 */
export const INFO_LIST_QUERY_KEY = 'infos';
export const INFO_QUERY_KEY = 'info';
export const ME_QUERY_KEY = 'me';
export const USER_ACADEMIC_QUERY_KEY = 'userAcademic';
export const CURRENT_COURSES_QUERY_KEY = 'currentCourses';
export const CALENDAR_EVENTS_QUERY_KEY = 'calendar-events';
export const CATEGORIES_QUERY_KEY = 'categories';
export const COURSE_CATALOGUE_QUERY_KEY = 'courses';
export const ANGKATAN_QUERY_KEY = 'angkatan';
export const UNSUBSCRIBED_QUERY_KEY = 'unsubscribe';
export const CHATROOMS_QUERY_KEY = 'chatrooms';
export const FORM_QUERY_KEY = 'form';
export const CREDITS_QUERY_KEY = 'credits';
