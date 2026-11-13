import type { rolesEnums } from '../db/roles-group';

type Role = (typeof rolesEnums)[number];

/**
 * Who may call a route.
 * - `anyone`: no session needed.
 * - `member`: any signed-in member; anyone else gets 401.
 * - a list of roles: signed-in members holding at least one of them; anyone else gets 401 `{ "error": "Unauthorized" }`,
 *   before the request is validated (`forRoles` in `middlewares/role.middleware.ts`). `checkedIn: 'handler'` marks a
 *   route whose handler checks the role itself, after validation.
 *
 * `note` says what the handler decides further: whose row it is, the post's audience, the member's angkatan.
 */
export type RouteAccess =
  | { who: 'anyone' | 'member'; note?: string }
  | { who: readonly Role[]; checkedIn?: 'handler'; note?: string };

/**
 * Every route the API serves, by `METHOD /path` as the OpenAPI document writes it, and who may call it.
 * `tests/route-access.test.ts` fails on a route missing here, and checks each row with requests.
 *
 * Not a route, so not listed: the socket (`websocket/connection.ts`) accepts only a valid session; a member joins
 * their own Curhat rooms, and Welfare (`curhatadmin`) every room (`lib/curhat.ts`).
 */
export const ROUTE_ACCESS: Record<string, RouteAccess> = {
  'GET /': { who: 'anyone' },
  'GET /health': { who: 'anyone' },
  'GET /doc': { who: 'anyone', note: 'development and staging only' },
  'GET /swagger': { who: 'anyone', note: 'development and staging only' },

  // Signing in and out
  'GET /api/login': { who: 'anyone' },
  'POST /api/auth/login/accesstoken': { who: 'anyone' },
  'GET /api/auth/google/callback': {
    who: 'anyone',
    note: 'only with the state this browser was given at GET /api/login',
  },
  'POST /api/auth/login/dev': {
    who: 'anyone',
    note: 'development and staging only, when test login is set up',
  },
  'GET /api/auth/login/bypass': {
    who: 'anyone',
    note: 'development and staging only, with the bypass key',
  },
  'POST /api/logout': { who: 'member' },
  'GET /api/me': { who: 'member' },
  'GET /api/auth/groups': { who: 'member', note: 'their own groups' },

  // Push
  'PUT /api/push/logout': {
    who: 'anyone',
    note: 'signs out the device it names; runs after the session has ended',
  },
  'POST /api/push/register': { who: 'member', note: 'their own device' },
  'POST /api/push/broadcast': { who: ['ring1'] },

  'POST /api/media/upload': { who: 'member' },
  'GET /api/open-graph': { who: 'member' },
  'GET /api/markdown/credits': { who: 'member' },
  'GET /api/programme-windows': { who: 'member' },

  // Pengumuman: posts, comments, reactions
  'GET /api/info': {
    who: 'member',
    note: 'posts for their angkatan, courses and groups',
  },
  'GET /api/info/{infoId}': { who: 'member', note: 'a post they may see' },
  'POST /api/info': {
    who: 'member',
    note: "the category's roles; groups only their own (any for admin)",
  },
  'DELETE /api/info/{infoId}': { who: 'member', note: 'the author, or admin' },
  'POST /api/info/{infoId}/read': {
    who: 'member',
    note: 'a post they may see',
  },
  'POST /api/info/read-all': { who: 'member' },
  'POST /api/info/{infoId}/renotify': { who: 'member', note: 'the author' },
  'GET /api/comments': { who: 'member', note: 'on a post they may see' },
  'GET /api/comment/{commentId}': {
    who: 'member',
    note: 'on a post they may see',
  },
  'POST /api/comment': { who: 'member', note: 'on a post they may see' },
  'PUT /api/comment/{commentId}': { who: 'member', note: 'the author' },
  'DELETE /api/comment/{commentId}': {
    who: 'member',
    note: 'the author, or admin',
  },
  'GET /api/reaction': { who: 'member', note: 'on a post they may see' },
  'PUT /api/reaction': { who: 'member', note: 'on a post they may see' },
  'DELETE /api/reaction/comment/{commentId}': {
    who: 'member',
    note: 'their own',
  },
  'DELETE /api/reaction/info/{infoId}': { who: 'member', note: 'their own' },
  'GET /api/category': { who: 'member' },
  'GET /api/category/info': {
    who: 'member',
    note: 'the categories their roles may post in',
  },
  'GET /api/angkatan': { who: 'member' },
  'GET /api/unsubscribe/category/{categoryId}': {
    who: 'member',
    note: 'their own',
  },
  'GET /api/unsubscribe/categories': { who: 'member', note: 'their own' },
  'POST /api/unsubscribe/category': { who: 'member', note: 'their own' },
  'POST /api/unsubscribe/categories': { who: 'member', note: 'their own' },
  'DELETE /api/unsubscribe/category': { who: 'member', note: 'their own' },
  'DELETE /api/unsubscribe/categories': { who: 'member', note: 'their own' },

  // Kalender and courses
  'GET /api/calendar/event': { who: 'member' },
  'GET /api/calendar/event/{eventId}': { who: 'member' },
  'GET /api/calendar/group': { who: 'member' },
  'GET /api/calendar/me': { who: 'member' },
  'POST /api/calendar/event': {
    who: 'member',
    note: 'akademik for an Akademik event, ring1 for any other (403)',
  },
  'PUT /api/calendar/event/{eventId}': {
    who: 'member',
    note: 'akademik for an Akademik event, ring1 for any other (403)',
  },
  'DELETE /api/calendar/event/{eventId}': {
    who: 'member',
    note: 'akademik for an Akademik event, ring1 for any other (403)',
  },
  'GET /api/course': { who: 'member' },
  'GET /api/course/{courseId}': { who: 'member' },
  'POST /api/course': { who: ['akademik', 'admin'] },
  'PUT /api/course/{courseId}': { who: ['akademik', 'admin'] },
  'DELETE /api/course/{courseId}': { who: ['akademik', 'admin'] },
  'GET /api/course/take': { who: 'member', note: 'their own' },
  'GET /api/course/take/current': { who: 'member', note: 'their own' },
  'POST /api/course/take': { who: 'member', note: 'their own' },
  'PUT /api/course/take/batch': { who: 'member', note: 'their own' },
  'DELETE /api/course/take/batch': { who: 'member', note: 'their own' },

  // Services
  'GET /api/testimoni/course/{courseId}': { who: 'member' },
  'POST /api/testimoni': { who: ['akademik'] },
  'GET /api/user': { who: 'member', note: 'their own profile' },
  'GET /api/user/academic': { who: 'member', note: 'their own' },
  'GET /api/user/nim': { who: 'member' },
  'GET /api/competitions': { who: 'member' },
  'GET /api/competitions/categories': { who: 'member' },
  'POST /api/competitions': { who: ['cnc'] },
  'PUT /api/competitions/{id}': { who: ['cnc'] },
  'DELETE /api/competitions/{competitionId}': { who: ['cnc'] },

  // Curhat Yuk!
  'POST /api/curhat/chatroom': { who: 'member', note: 'their own room' },
  'GET /api/curhat/chatrooms': {
    who: 'member',
    note: 'their own rooms; every room for curhatadmin',
  },
  'GET /api/curhat/chatrooms/unread': {
    who: 'member',
    note: 'their own rooms; every room for curhatadmin',
  },
  'DELETE /api/curhat/chatroom/{chatroomId}': {
    who: 'member',
    note: "the room's owner (401)",
  },
  'POST /api/curhat/chatroom/{chatroomId}/read': {
    who: 'member',
    note: "the room's owner, or curhatadmin (403)",
  },
  'PUT /api/curhat/chatroom/{chatroomId}/pin': {
    who: ['curhatadmin'],
    checkedIn: 'handler',
  },

  // Magang SPARTA
  'GET /api/internship/window': { who: 'member' },
  'GET /api/internship/departments': { who: 'member' },
  'POST /api/internship/departments': { who: ['peoplemanage', 'admin'] },
  'PUT /api/internship/departments/{id}': { who: ['peoplemanage', 'admin'] },
  'DELETE /api/internship/departments/{id}': { who: ['peoplemanage', 'admin'] },
  'POST /api/internship/divisions': { who: ['peoplemanage', 'admin'] },
  'PUT /api/internship/divisions/{id}': { who: ['peoplemanage', 'admin'] },
  'DELETE /api/internship/divisions/{id}': { who: ['peoplemanage', 'admin'] },
  'GET /api/internship/submission': {
    who: 'member',
    note: 'their own; only the angkatan SPARTA is for (401)',
  },
  'PUT /api/internship/submission': {
    who: 'member',
    note: 'their own; only the angkatan SPARTA is for (401)',
  },
  'POST /api/internship/submission/submit': {
    who: 'member',
    note: 'their own; only the angkatan SPARTA is for (401)',
  },
  'GET /api/internship/submissions': { who: ['peoplemanage', 'admin'] },
  'GET /api/internship/submissions/{id}': { who: ['peoplemanage', 'admin'] },

  // Form
  'GET /api/form': { who: 'member', note: 'forms for their angkatan' },
  'GET /api/form/{formId}': {
    who: 'member',
    note: "its questions only for the form's angkatan, or admin",
  },
  'GET /api/form/{formId}/my-response': { who: 'member', note: 'their own' },
  'POST /api/form/{formId}/response': {
    who: 'member',
    note: "the form's angkatan, while it is open (403)",
  },
  'GET /api/form/admin/list': { who: ['admin'] },
  'GET /api/form/{formId}/responses': { who: ['admin'] },
  'GET /api/form/{formId}/responses/count': { who: ['admin'] },
  'GET /api/form/{formId}/analytics': { who: ['admin'] },
};
