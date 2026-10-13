/**
 * Default, read-only answers for every GET the app makes, computed from the test's fixture data (`db`).
 * Writes have no defaults: a test that writes registers its own handler (see mock.ts).
 */
import type {
  AuthService,
  CalendarService,
  CategoryService,
  CommentService,
  CompetitionsService,
  CourseService,
  CurhatService,
  FormService,
  Info,
  InfoService,
  InternshipService,
  MarkdownService,
  OpenGraphService,
  ProgrammeWindowService,
  ReactionService,
  TestimoniService,
  UnsubscribeService,
  UserFinderService,
  UserProfileService,
} from '../../src/api/generated';
import {
  NOW,
  formSectionsVisibleFor,
  formStatusFor,
  isSpartaEligible,
  spartaWindowFor,
} from '../fixtures/api';
import { reply, type Handler } from './mock';

const PAGE = 10;
/** What a generated client method resolves to: `ok<R<InfoService['getListInfo']>>(...)` type-checks a response. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R<F extends (...args: any[]) => unknown> = Awaited<ReturnType<F>>;
const ok = <T>(value: T): T => value;
const signedIn: (h: Handler) => Handler = (h) => (req) =>
  req.db.signedIn && req.db.me
    ? h(req)
    : reply.status(401, { message: 'Unauthorized' });
const notFound = (what: string) =>
  reply.status(404, { message: `${what} not found` });
const includes = (hay: string | null | undefined, needle: string) =>
  (hay ?? '').toLowerCase().includes(needle.toLowerCase());

function listInfos(infos: Info[], q: URLSearchParams): Info[] {
  const search = q.get('search')?.trim();
  const excluded = q.getAll('excludeCategory').flatMap((v) => v.split(','));
  const sort = q.get('sort') ?? 'newest';
  const offset = Number(q.get('offset') ?? 0);
  return infos
    .filter((i) => q.get('unread') !== 'true' || !i.isRead)
    // As the API (info.repo.ts): `excludeCategory` takes category names, and a post is left out when any of its
    // categories is excluded; `search` matches the title and the content, never the author (P1-B).
    .filter(
      (i) =>
        !excluded.length ||
        !i.infoCategories?.some((c) => excluded.includes(c.category.name)),
    )
    .filter((i) => !search || includes(`${i.title} ${i.content}`, search))
    .sort(
      (a, b) =>
        (sort === 'oldest' ? 1 : -1) *
        (Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    )
    .slice(offset, offset + PAGE);
}

export const defaultHandlers: Record<string, Handler> = {
  // Session and profile
  'GET /api/me': signedIn(({ db }) => ok<R<AuthService['getMe']>>(db.me!)),
  'GET /api/user': signedIn(({ db }) =>
    ok<R<UserProfileService['getUserProfile']>>(db.me!),
  ),
  'GET /api/user/academic': signedIn(({ db }) =>
    ok<R<UserProfileService['getUserAcademic']>>(db.academic),
  ),
  'GET /api/auth/groups': signedIn(({ db }) =>
    ok<R<AuthService['getUserGroups']>>(db.groups),
  ),
  'GET /api/markdown/credits': signedIn(({ db }) =>
    ok<R<MarkdownService['getCredits']>>(db.credits),
  ),
  'GET /api/unsubscribe/categories': signedIn(({ db }) =>
    ok<R<UnsubscribeService['getListUserUnsubscribeCategory']>>({
      userId: db.me!.id,
      categoryId: db.mutedCategoryIds,
    }),
  ),
  'GET /api/unsubscribe/category/:categoryId': signedIn(({ db, params }) =>
    ok<R<UnsubscribeService['getUserUnsubscribeCategory']>>({
      userId: db.me!.id,
      categoryId: params.categoryId,
      unsubscribed: db.mutedCategoryIds.includes(params.categoryId),
    }),
  ),

  // Announcements ("info")
  'GET /api/category': signedIn(({ db }) =>
    ok<R<CategoryService['getListCategory']>>({ categories: db.categories }),
  ),
  'GET /api/category/info': signedIn(({ db }) =>
    ok<R<CategoryService['getInfoListCategory']>>({
      categories: db.postableCategories,
    }),
  ),
  'GET /api/angkatan': signedIn(({ db }) =>
    ok<R<CategoryService['getListAngkatan']>>(db.angkatan),
  ),
  'GET /api/info': signedIn(({ db, query }) =>
    ok<R<InfoService['getListInfo']>>({ infos: listInfos(db.infos, query) }),
  ),
  'GET /api/info/:infoId': signedIn(
    ({ db, params }) =>
      ok<R<InfoService['getInfoById']> | undefined>(
        db.infos.find((i) => i.id === params.infoId),
      ) ?? notFound('info'),
  ),
  'GET /api/comments': signedIn(({ db, query }) => {
    const list = [...(db.comments[query.get('infoId') ?? ''] ?? [])];
    if (query.get('sort') !== 'oldest') list.reverse();
    return ok<R<CommentService['getCommentsList']>>({ comment: list });
  }),
  'GET /api/comment/:commentId': signedIn(
    ({ db, params }) =>
      ok<R<CommentService['getCommentsById']> | undefined>(
        Object.values(db.comments)
          .flat()
          .find((c) => c.id === params.commentId),
      ) ?? notFound('comment'),
  ),
  'GET /api/reaction': signedIn(({ db, query }) => {
    const info = db.infos.find((i) => i.id === query.get('infoId'));
    if (info) return ok<R<ReactionService['getReactions']>>(info.reactions);
    const comment = Object.values(db.comments)
      .flat()
      .find((c) => c.id === query.get('commentId'));
    return ok<R<ReactionService['getReactions']>>(
      comment?.reactions ?? { totalReactions: 0, reactionsCount: [] },
    );
  }),
  'GET /api/open-graph': signedIn(({ query }) => {
    const url = query.get('url') ?? '';
    const titles: Record<string, string> = {
      'docs.google.com/spreadsheets': 'Jadwal UTS Ganjil 2026/2027',
      'docs.google.com/forms': 'Formulir Cari Tim Gemastik XIX',
      's.hmif.dev': 'Mading Beasiswa HMIF',
    };
    const title = Object.entries(titles).find(([host]) =>
      url.includes(host),
    )?.[1];
    return ok<R<OpenGraphService['openGraphScrape']>>(
      title
        ? {
            success: true,
            ogTitle: title,
            ogUrl: url,
            ogSiteName: new URL(url.startsWith('http') ? url : `https://${url}`)
              .host,
          }
        : { success: false },
    );
  }),

  // Calendar
  'GET /api/calendar/me': signedIn(({ db, query }) => {
    const month = Number(query.get('month'));
    const year = Number(query.get('year'));
    return ok<R<CalendarService['getPersonalCalendar']>>(
      db.events.filter((e) => {
        // The API compares in the server's zone (WIB); the fixtures' times are WIB.
        const d = new Date(Date.parse(e.start) + 7 * 36e5);
        return d.getUTCMonth() + 1 === month && d.getUTCFullYear() === year;
      }),
    );
  }),
  'GET /api/calendar/event': signedIn(({ db, query }) =>
    ok<R<CalendarService['getCalendarEvent']>>(
      db.events.filter(
        (e) => !query.get('category') || e.category === query.get('category'),
      ),
    ),
  ),
  'GET /api/calendar/event/:eventId': signedIn(
    ({ db, params }) =>
      ok<R<CalendarService['getCalendarEventById']> | undefined>(
        db.events.find((e) => e.id === params.eventId),
      ) ?? notFound('event'),
  ),
  'GET /api/calendar/group': signedIn(({ db }) =>
    ok<R<CalendarService['getCalendarGroup']>>(db.calendarGroups),
  ),

  // Courses
  'GET /api/course': signedIn(({ db, query }) => {
    const search = query.get('search')?.trim();
    return ok<R<CourseService['getlistCourses']>>({
      courses: db.courses.filter(
        (c) =>
          (!query.get('major') || c.major === query.get('major')) &&
          (!query.get('semester') ||
            String(c.semester) === query.get('semester')) &&
          (!query.get('type') || c.type === query.get('type')) &&
          (!query.get('curriculumYear') ||
            String(c.curriculumYear) === query.get('curriculumYear')) &&
          (!search || includes(`${c.code} ${c.name}`, search)),
      ),
    });
  }),
  'GET /api/course/:courseId': signedIn(
    ({ db, params }) =>
      ok<R<CourseService['getCourseById']> | undefined>(
        db.courses.find((c) => c.id === params.courseId),
      ) ?? notFound('course'),
  ),
  'GET /api/course/take': signedIn(({ db }) =>
    ok<R<CourseService['getUserCourse']>>(db.myCourses),
  ),
  'GET /api/course/take/current': signedIn(({ db }) =>
    ok<R<CourseService['getCurrentUserCourse']>>(db.myCourses),
  ),

  // Services
  // As the API answers (src/lib/nim-finder.ts): only name, NIM, programme and photo; the closest NIM matches
  // first (exact, prefix, other), then names, A–Z within each; at most 30. Under 3 characters (trimmed) is a 400.
  'GET /api/user/nim': signedIn(({ db, query }) => {
    const search = query.get('search')?.trim() ?? '';
    if (search.length < 3)
      return reply.status(400, {
        errors: {
          formErrors: [],
          fieldErrors: {
            search: ['String must contain at least 3 character(s)'],
          },
        },
      });
    const rank = (nim: string) =>
      nim === search
        ? 0
        : nim.startsWith(search)
          ? 1
          : nim.includes(search)
            ? 2
            : 3;
    return ok<R<UserFinderService['getUser']>>(
      db.members
        .filter((m) => includes(m.fullName, search) || m.nim.includes(search))
        .sort(
          (a, b) =>
            rank(a.nim) - rank(b.nim) || a.fullName.localeCompare(b.fullName),
        )
        .slice(0, 30)
        .map(({ fullName, nim, major, picture }) => ({
          fullName,
          nim,
          major,
          picture: picture ?? null,
        })),
    );
  }),
  'GET /api/testimoni/course/:courseId': signedIn(({ db, params }) =>
    ok<R<TestimoniService['getTestimoniByCourseId']>>(
      db.testimonials.filter((t) => t.courseId === params.courseId),
    ),
  ),
  'GET /api/competitions/categories': signedIn(() =>
    ok<R<CompetitionsService['getCompetitionCategories']>>([
      'Competitive Programming',
      'Capture The Flag',
      'Data Science / Data Analytics',
      'UI/UX',
      'Game Development',
      'Business IT Case',
      'Innovation',
      'Web Development',
    ]),
  ),
  'GET /api/competitions': signedIn(({ db, query }) => {
    const open = db.competitions.filter(
      (c) => Date.parse(c.registrationDeadline) >= Date.parse(NOW),
    );
    const category = query.get('category');
    const list = open.filter(
      (c) => !category || (c.categories as string[]).includes(category),
    );
    list.sort((a, b) =>
      query.get('sort') === 'deadline'
        ? Date.parse(a.registrationDeadline) -
          Date.parse(b.registrationDeadline)
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    const offset = Number(query.get('offset') ?? 0);
    return ok<R<CompetitionsService['getCompetitionList']>>({
      competitions: list.slice(offset, offset + PAGE),
    });
  }),

  // Curhat Yuk!
  'GET /api/curhat/chatrooms': signedIn(({ db }) =>
    ok<R<CurhatService['getUserChatrooms']>>(db.chatrooms),
  ),
  // As the API counts them: only your rooms, only messages you didn't send, without a read mark; rooms with none
  // are left out.
  'GET /api/curhat/chatrooms/unread': signedIn(({ db }) =>
    ok<R<CurhatService['unreadCountChatroomMessages']>>(
      Object.values(db.chatrooms)
        .map((r) => ({
          chatroomId: r.id,
          unreadCount: (r.messages ?? []).filter(
            (m) => !m.isSender && !db.chatroomReads.includes(m.id),
          ).length,
        }))
        .filter((r) => r.unreadCount > 0),
    ),
  ),

  // Programme windows: the API answers only the windows open now for this member, so `db.windows` holds just those.
  'GET /api/programme-windows': signedIn(({ db }) =>
    ok<R<ProgrammeWindowService['listProgrammeWindows']>>({
      windows: db.windows,
    }),
  ),

  // Forms
  'GET /api/form': signedIn(({ db }) =>
    ok<R<FormService['listForms']>>({ forms: db.forms }),
  ),
  'GET /api/form/admin/list': signedIn(({ db }) =>
    db.me!.roles.includes('admin')
      ? ok<R<FormService['listAllForms']>>({ forms: db.adminForms })
      : reply.status(403),
  ),
  // As the API answers: the member's status, and no questions until the form opens, even if switched off (kept once it closes).
  'GET /api/form/:formId': signedIn(({ db, params }) => {
    const form = Object.values(db.formDetails).find(
      (f) => f.id === params.formId || f.slug === params.formId,
    );
    if (!form) return notFound('form');
    const nim = db.me!.nim;
    const status = formStatusFor(form, {
      responded: !!db.myResponses[form.id],
      nim,
    });
    return ok<R<FormService['getForm']>>({
      ...form,
      sections: formSectionsVisibleFor(form, nim) ? form.sections : null,
      status,
    });
  }),
  'GET /api/form/:formId/my-response': signedIn(
    (
      { db, params }, // The API answers 200 with null when you haven't responded; its OpenAPI type omits the null (NOTES.md).
    ) =>
      ok<R<FormService['getMyFormResponse']> | null>(
        db.myResponses[params.formId] ?? null,
      ),
  ),
  'GET /api/form/:formId/responses': signedIn(({ db, params, query }) => {
    const all = db.adminResponses[params.formId] ?? [];
    const search = query.get('search')?.trim();
    const list = search
      ? all.filter(
          (r) => includes(r.fullName, search) || r.nim.includes(search),
        )
      : all;
    const page = Number(query.get('page') ?? 1);
    const limit = Number(query.get('limit') ?? 20);
    return ok<R<FormService['listFormResponses']>>({
      responses: list.slice((page - 1) * limit, page * limit),
      total: list.length,
      page,
      limit,
    });
  }),
  'GET /api/form/:formId/responses/count': signedIn(({ db, params }) =>
    ok<R<FormService['getFormResponsesCount']>>({
      total: db.adminResponses[params.formId]?.length ?? 0,
    }),
  ),
  'GET /api/form/:formId/analytics': signedIn(
    ({ db, params }) =>
      ok<R<FormService['getFormAnalytics']> | undefined>(
        db.formAnalytics[params.formId],
      ) ?? notFound('form'),
  ),

  // SPARTA Magang (closed; kept for the admin table)
  'GET /api/internship/departments': signedIn(({ db }) =>
    ok<R<InternshipService['getInternshipDepartments']>>({
      departments: db.internshipDepartments,
    }),
  ),
  // As the API answers: 401 for a member SPARTA isn't for, 200 null when there's no submission yet.
  'GET /api/internship/submission': signedIn(({ db }) =>
    !isSpartaEligible(db.me!)
      ? reply.status(401, {
          error: 'You are not eligible to access SPARTA internship form',
        })
      : ok<R<InternshipService['getMyInternshipSubmission']> | null>(
          db.internshipSubmissions.find((s) => s.userId === db.me!.id) ?? null,
        ),
  ),
  'GET /api/internship/window': signedIn(({ db }) =>
    ok<R<InternshipService['getInternshipWindow']>>(spartaWindowFor(db)),
  ),
  'GET /api/internship/submissions': signedIn(({ db, query }) => {
    const locked = query.get('locked');
    const list = db.internshipSubmissions.filter(
      (s) => locked == null || String(s.isLocked) === locked,
    );
    const offset = Number(query.get('offset') ?? 0);
    return ok<R<InternshipService['listInternshipSubmissions']>>({
      submissions: list.slice(offset, offset + 50),
    });
  }),
  'GET /api/internship/submissions/:id': signedIn(
    ({ db, params }) =>
      ok<R<InternshipService['getInternshipSubmissionById']> | undefined>(
        db.internshipSubmissions.find((s) => s.id === params.id),
      ) ?? notFound('submission'),
  ),
};
