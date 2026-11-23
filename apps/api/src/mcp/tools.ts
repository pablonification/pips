import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z, type ZodRawShape } from 'zod';

/**
 * The tools an MCP app gets (docs/adr/0021-*). Each one calls an existing API route as the member, through
 * `ApiCall`, and the route's own checks decide: a tool never checks a role, an angkatan or an author itself.
 *
 * Never a tool here: Curhat Yuk! (rooms stay between a member and Welfare), push devices, signing in, uploads.
 */

export interface ApiAnswer {
  status: number;
  body: unknown;
}

/** One request to the API as the member: `path` under `/api`, `query` as the address's query, `body` as JSON. */
export type ApiCall = (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: {
    query?: Record<string, string | number | boolean | string[] | undefined>;
    body?: unknown;
  },
) => Promise<ApiAnswer>;

/** Drops nulls, undefined and empty lists, so the model reads only what is there. Adds nothing. */
export function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[k] = compact(v);
    }
    return out;
  }
  return value;
}

const text = (value: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(compact(value)) }],
});

/** A route's refusal, as the model reads it: the status and what the route said. */
export function refusal(answer: ApiAnswer): CallToolResult {
  const reason =
    {
      400: 'Bad request',
      401: 'Not allowed for your roles, or not signed in',
      403: 'Not allowed',
      404: 'Not found',
      409: 'Conflict',
      413: 'Too large',
      429: 'Too many requests; try again in a minute',
    }[answer.status] ?? 'Failed';
  const said =
    typeof answer.body === 'string'
      ? answer.body
      : JSON.stringify(compact(answer.body));
  return {
    isError: true,
    content: [{ type: 'text', text: `${answer.status} ${reason}: ${said}` }],
  };
}

/** The route's answer as tool output, shaped by `pick` (which only selects from what the route sent). */
const answer = (res: ApiAnswer, pick: (body: any) => unknown = (b) => b) =>
  res.status >= 400 ? refusal(res) : text(pick(res.body));

const id = (v: string) => encodeURIComponent(v);

/** A form's answers as the routes take them (`types/form.types.ts`). */
const formAnswers = z
  .array(
    z.object({
      questionId: z.string(),
      answer: z.union([z.string(), z.array(z.string())]),
      other: z.string().optional(),
    }),
  )
  .min(1);

/** A saved detail in Data diri (`lib/member-details.ts`): a value sets it, null removes it, left out keeps it. */
const detail = z.string().nullable().optional();

interface ToolSpec<S extends ZodRawShape> {
  name: string;
  title: string;
  description: string;
  /** Changes something: needs the `pips.write` scope, and is hidden from a read-only token. */
  write: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  input: S;
  run: (
    args: z.objectOutputType<S, z.ZodTypeAny>,
    api: ApiCall,
  ) => Promise<CallToolResult>;
}

function tool<S extends ZodRawShape>(spec: ToolSpec<S>) {
  return spec as unknown as ToolSpec<ZodRawShape>;
}

// Shapes that keep what a member reads and drop the rest (ids stay, so the model can act on a row).

const author = (a: any) => a && { id: a.id, name: a.fullName };

const post = (i: any) => ({
  id: i.id,
  title: i.title,
  content: i.content,
  createdAt: i.createdAt,
  author: author(i.creator),
  categories: i.infoCategories?.map((c: any) => c.category?.name),
  angkatan: i.infoAngkatan?.map((a: any) => a.angkatan?.name),
  courses: i.infoCourses?.map((c: any) => ({
    code: c.course?.code,
    name: c.course?.name,
    class: c.class,
  })),
  groups: i.infoGroups,
  pictures: i.infoMedias?.map((m: any) => m.media?.url),
  isRead: i.isRead,
  comments: i.comments,
  reactions: i.reactions && {
    total: i.reactions.totalReactions,
    counts: i.reactions.reactionsCount,
    mine: i.reactions.userReaction,
  },
});

const comment = (c: any) => ({
  id: c.id,
  content: c.content,
  createdAt: c.createdAt,
  author: author(c.creator),
  reactions: c.reactions && {
    total: c.reactions.totalReactions,
    mine: c.reactions.userReaction,
  },
});

const event = (e: any) => ({
  id: e.id,
  title: e.title,
  description: e.description,
  start: e.start,
  end: e.end,
  category: e.category,
  courseId: e.courseId,
  googleCalendarUrl: e.googleCalendarUrl,
});

const course = (c: any) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  major: c.major,
  semester: c.semester,
  credits: c.credits,
  type: c.type,
  curriculumYear: c.curriculumYear,
});

const REACTIONS = [
  'grin',
  'heart-eyes',
  'fire',
  'cry',
  'screaming',
  'party',
] as const;

const offset = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe('How many to skip, to read the next page');

export const TOOLS: Array<ToolSpec<ZodRawShape>> = [
  // Who the member is
  tool({
    name: 'get_my_profile',
    title: 'My profile',
    description:
      'The signed-in member (anggota): name, NIM, major, angkatan and roles (none listed for a plain anggota). Roles decide what else you may do: akademik adds Akademik events and testimonials, ring1 Himpunan events, cnc competitions in Info Lomba and admin Rekap Form.',
    write: false,
    input: {},
    run: async (_args, api) =>
      answer(await api('GET', '/me'), (me) => ({
        id: me.id,
        nim: me.nim,
        name: me.fullName,
        email: me.email,
        major: me.major,
        angkatan: me.angkatan,
        campus: me.region,
        roles: me.roles,
      })),
  }),
  tool({
    name: 'get_my_details',
    title: 'My Data diri',
    description:
      'Data diri: the account facts (never changed here) and the details you saved for forms that request them (WhatsApp, LINE, Instagram, address, hometown, emergency contact, health, birth date, photos), each null until given. Some are sensitive (address, emergency contact, health, birth date): repeat them only to the member.',
    write: false,
    input: {},
    run: async (_a, api) => answer(await api('GET', '/user/details')),
  }),
  tool({
    name: 'update_my_details',
    title: 'Change my Data diri',
    description:
      'Saves or removes details in Data diri, which forms that request them send along with an answer once the member agrees. A value sets one, null removes it, a detail left out stays. Phone numbers need at least nine digits; birthDate is YYYY-MM-DD. Name, NIM, major, angkatan, campus and email come from the account and can’t be changed; the two photos are added in the app (Profil › Data diri).',
    write: true,
    idempotent: true,
    input: {
      whatsapp: detail,
      line: detail,
      instagram: detail,
      address: detail.describe('Where you live while studying'),
      hometown: detail,
      emergencyContact: z
        .object({
          name: z.string(),
          relation: z.enum(['Ayah', 'Ibu', 'Wali', 'Saudara', 'Lainnya']),
          phone: z.string(),
        })
        .nullable()
        .optional(),
      health: detail.describe('Health conditions the committee should know'),
      birthDate: detail,
    },
    run: async (a, api) =>
      answer(await api('PATCH', '/user/details', { body: a })),
  }),
  tool({
    name: 'list_my_courses',
    title: 'My courses this semester',
    description:
      "The courses you added to Mata kuliahku for this semester, with each course's Ding Dong folder. It is what you chose in PIPS!, not your enrollment at ITB: it decides which course Pengumuman and Kalender events reach you.",
    write: false,
    input: {},
    run: async (_args, api) =>
      answer(await api('GET', '/course/take/current'), (rows) =>
        (rows as any[]).map((r) => ({
          ...course(r.course ?? {}),
          class: r.class,
          dingdongUrl: r.course?.dingdongUrl,
        })),
      ),
  }),
  tool({
    name: 'add_my_courses',
    title: 'Add courses to Mata kuliahku',
    description:
      'Adds courses to Mata kuliahku for this semester, by their ids from search_courses. A course already there stays once.',
    write: true,
    idempotent: true,
    input: {
      courseIds: z.array(z.string().min(1)).min(1).max(30),
    },
    run: async (a, api) =>
      answer(
        await api('PUT', '/course/take/batch', {
          body: a.courseIds.map((courseId) => ({ courseId })),
        }),
        (rows) =>
          (rows as any[]).map((r) => ({
            courseId: r.courseId,
            class: r.class,
          })),
      ),
  }),
  tool({
    name: 'remove_my_courses',
    title: 'Remove courses from Mata kuliahku',
    description:
      'Removes courses from Mata kuliahku. Their course Pengumuman and Kalender events stop reaching you.',
    write: true,
    destructive: true,
    idempotent: true,
    input: {
      courseIds: z.array(z.string().min(1)).min(1).max(30),
    },
    run: async (a, api) =>
      answer(
        await api('DELETE', '/course/take/batch', {
          body: { courseIds: a.courseIds },
        }),
        () => ({ removed: a.courseIds }),
      ),
  }),

  // Pengumuman
  tool({
    name: 'list_announcements',
    title: 'List Pengumuman',
    description:
      'Pengumuman (announcements) you may see: those for your angkatan, courses and groups, newest first. 10 per page.',
    write: false,
    input: {
      search: z
        .string()
        .max(200)
        .optional()
        .describe('Words in the title or text'),
      unreadOnly: z
        .boolean()
        .optional()
        .describe('Only those you have not read'),
      sort: z.enum(['newest', 'oldest']).optional(),
      offset,
    },
    run: async (a, api) =>
      answer(
        await api('GET', '/info', {
          query: {
            search: a.search,
            unread: a.unreadOnly ? 'true' : undefined,
            sort: a.sort,
            offset: a.offset,
          },
        }),
        (b) => (b.infos as any[]).map(post),
      ),
  }),
  tool({
    name: 'get_announcement',
    title: 'Read a Pengumuman',
    description:
      'One Pengumuman you may see, with its comments. Reading it here does not mark it read.',
    write: false,
    input: { announcementId: z.string().min(1) },
    run: async (a, api) => {
      const info = await api('GET', `/info/${id(a.announcementId)}`);
      if (info.status >= 400) return refusal(info);
      const comments = await api('GET', '/comments', {
        query: { infoId: a.announcementId, sort: 'oldest' },
      });
      if (comments.status >= 400) return refusal(comments);
      return text({
        ...post(info.body),
        commentList: ((comments.body as any).comment as any[]).map(comment),
      });
    },
  }),
  tool({
    name: 'get_posting_options',
    title: 'Where you may post',
    description:
      'What a new Pengumuman can be aimed at: the categories your roles may post in, every angkatan, and your own groups. Use their ids in post_announcement.',
    write: false,
    input: {},
    run: async (_args, api) => {
      const [categories, angkatan, groups] = await Promise.all([
        api('GET', '/category/info'),
        api('GET', '/angkatan'),
        api('GET', '/auth/groups'),
      ]);
      for (const r of [categories, angkatan, groups])
        if (r.status >= 400) return refusal(r);
      return text({
        categories: ((categories.body as any).categories as any[]).map((c) => ({
          id: c.id,
          name: c.name,
        })),
        angkatan: (angkatan.body as any[]).map((x) => ({
          id: x.id,
          year: x.year,
          name: x.name,
        })),
        groups: groups.body,
      });
    },
  }),
  tool({
    name: 'post_announcement',
    title: 'Post a Pengumuman',
    description:
      "Posts a Pengumuman as you and notifies its audience. The categories decide who may post: each lists the roles allowed (see get_posting_options). Without angkatan, groups or courses it goes to everyone. Pictures can't be added here.",
    write: true,
    input: {
      title: z.string().min(1).max(100),
      content: z.string().min(1).max(1000),
      categoryIds: z.array(z.string()).min(1),
      angkatanIds: z
        .array(z.string())
        .optional()
        .describe('Angkatan ids; leave out for every angkatan'),
      groups: z
        .array(z.string())
        .optional()
        .describe('Your own groups only (any group for admin)'),
      courses: z
        .array(
          z.object({
            courseId: z.string(),
            class: z.number().int().optional(),
          }),
        )
        .optional(),
    },
    run: async (a, api) =>
      answer(
        await api('POST', '/info', {
          body: {
            title: a.title,
            content: a.content,
            forCategories: a.categoryIds,
            forAngkatan: a.angkatanIds,
            forGroups: a.groups,
            forCourses: a.courses,
          },
        }),
        (b) => ({ id: b.id, title: b.title, createdAt: b.createdAt }),
      ),
  }),
  tool({
    name: 'delete_announcement',
    title: 'Delete a Pengumuman',
    description: 'Deletes a Pengumuman. Only its author may, or an admin.',
    write: true,
    destructive: true,
    idempotent: true,
    input: { announcementId: z.string().min(1) },
    run: async (a, api) =>
      answer(await api('DELETE', `/info/${id(a.announcementId)}`), () => ({
        deleted: a.announcementId,
      })),
  }),
  tool({
    name: 'renotify_announcement',
    title: 'Notify again about a Pengumuman',
    description:
      'Sends the push notification for a Pengumuman you wrote once more, to the same audience. Only its author, and only while the app allows it again (a few hours after the last one).',
    write: true,
    input: { infoId: z.string().min(1) },
    run: async (a, api) =>
      answer(await api('POST', `/info/${id(a.infoId)}/renotify`), () => ({
        notified: a.infoId,
      })),
  }),
  tool({
    name: 'get_notification_settings',
    title: 'Notification settings',
    description:
      'The Pengumuman categories and whether each sends you push notifications (muted ones don’t; their posts still show in Pengumuman).',
    write: false,
    input: {},
    run: async (_a, api) => {
      const categories = await api('GET', '/category');
      if (categories.status >= 400) return refusal(categories);
      const muted = await api('GET', '/unsubscribe/categories');
      if (muted.status >= 400) return refusal(muted);
      const mutedIds = new Set<string>((muted.body as any)?.categoryId ?? []);
      return text(
        ((categories.body as any).categories as any[]).map((c) => ({
          id: c.id,
          name: c.name,
          muted: mutedIds.has(c.id),
        })),
      );
    },
  }),
  tool({
    name: 'set_notification_category',
    title: 'Mute or unmute a category',
    description:
      'Turns push notifications for one Pengumuman category off (muted true) or back on (muted false). The ids come from get_notification_settings.',
    write: true,
    idempotent: true,
    input: { categoryId: z.string().min(1), muted: z.boolean() },
    run: async (a, api) =>
      answer(
        await api(a.muted ? 'POST' : 'DELETE', '/unsubscribe/category', {
          body: { categoryId: a.categoryId },
        }),
        () => ({ categoryId: a.categoryId, muted: a.muted }),
      ),
  }),
  tool({
    name: 'mark_announcement_read',
    title: 'Mark a Pengumuman read',
    description: 'Marks a Pengumuman you may see as read, or unread again.',
    write: true,
    idempotent: true,
    input: {
      announcementId: z.string().min(1),
      unread: z.boolean().optional(),
    },
    run: async (a, api) =>
      answer(
        await api('POST', `/info/${id(a.announcementId)}/read`, {
          body: { unread: a.unread },
        }),
        () => ({ announcementId: a.announcementId, read: !a.unread }),
      ),
  }),
  tool({
    name: 'mark_all_announcements_read',
    title: 'Mark every Pengumuman read',
    description: 'Marks every Pengumuman you may see as read.',
    write: true,
    idempotent: true,
    input: {},
    run: async (_a, api) => answer(await api('POST', '/info/read-all')),
  }),
  tool({
    name: 'add_comment',
    title: 'Comment on a Pengumuman',
    description: 'Adds your comment to a Pengumuman you may see.',
    write: true,
    input: {
      announcementId: z.string().min(1),
      content: z.string().min(1).max(2000),
    },
    run: async (a, api) =>
      answer(
        await api('POST', '/comment', {
          body: { repliedInfoId: a.announcementId, content: a.content },
        }),
        comment,
      ),
  }),
  tool({
    name: 'edit_comment',
    title: 'Edit your comment',
    description: 'Changes the text of a comment. Only its author may.',
    write: true,
    idempotent: true,
    input: {
      commentId: z.string().min(1),
      content: z.string().min(1).max(2000),
    },
    run: async (a, api) =>
      answer(
        await api('PUT', `/comment/${id(a.commentId)}`, {
          body: { content: a.content },
        }),
        comment,
      ),
  }),
  tool({
    name: 'delete_comment',
    title: 'Delete a comment',
    description: 'Deletes a comment. Only its author may, or an admin.',
    write: true,
    destructive: true,
    idempotent: true,
    input: { commentId: z.string().min(1) },
    run: async (a, api) =>
      answer(await api('DELETE', `/comment/${id(a.commentId)}`), () => ({
        deleted: a.commentId,
      })),
  }),
  tool({
    name: 'react',
    title: 'React',
    description:
      'Gives your reaction to a Pengumuman or a comment (one per member; a new one replaces yours). Name exactly one of announcementId and commentId.',
    write: true,
    idempotent: true,
    input: {
      announcementId: z.string().optional(),
      commentId: z.string().optional(),
      reaction: z.enum(REACTIONS),
    },
    run: async (a, api) =>
      answer(
        await api('PUT', '/reaction', {
          body: {
            infoId: a.announcementId,
            commentId: a.commentId,
            reaction: a.reaction,
          },
        }),
        (r) => ({
          id: r.id,
          reaction: r.reaction,
          infoId: r.infoId,
          commentId: r.commentId,
        }),
      ),
  }),
  tool({
    name: 'remove_reaction',
    title: 'Remove your reaction',
    description:
      'Takes back your reaction to a Pengumuman or a comment. Name exactly one of announcementId and commentId.',
    write: true,
    idempotent: true,
    input: {
      announcementId: z.string().optional(),
      commentId: z.string().optional(),
    },
    run: async (a, api) => {
      if ((a.announcementId === undefined) === (a.commentId === undefined)) {
        return refusal({
          status: 400,
          body: 'Name exactly one of announcementId and commentId',
        });
      }
      return answer(
        a.announcementId !== undefined
          ? await api('DELETE', `/reaction/info/${id(a.announcementId)}`)
          : await api('DELETE', `/reaction/comment/${id(a.commentId ?? '')}`),
        () => ({ removed: true }),
      );
    },
  }),

  // Kalender
  tool({
    name: 'get_my_calendar',
    title: 'My Kalender',
    description:
      'Your Kalender for a month: Akademik events of your courses and Himpunan events. Times are ISO, WIB is UTC+7.',
    write: false,
    input: {
      month: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe('1 to 12; this month if left out'),
      year: z.number().int().min(2000).max(9999).optional(),
    },
    run: async (a, api) =>
      answer(
        await api('GET', '/calendar/me', {
          query: { month: a.month, year: a.year },
        }),
        (b) => (Array.isArray(b) ? b.map(event) : b),
      ),
  }),
  tool({
    name: 'list_calendar_events',
    title: 'Search Kalender',
    description:
      'Searches every Kalender event, by words, category (akademik or himpunan), course code, year or major.',
    write: false,
    input: {
      search: z.string().max(200).optional(),
      category: z.string().optional().describe('akademik or himpunan'),
      courseCode: z.string().optional(),
      year: z.string().optional(),
      major: z.enum(['IF', 'STI', 'OTHER']).optional(),
    },
    run: async (a, api) =>
      answer(await api('GET', '/calendar/event', { query: a }), (b) =>
        Array.isArray(b) ? b.map(event) : b,
      ),
  }),
  tool({
    name: 'get_calendar_event',
    title: 'Read a Kalender event',
    description: 'One Kalender event.',
    write: false,
    input: { eventId: z.string().min(1) },
    run: async (a, api) =>
      answer(await api('GET', `/calendar/event/${id(a.eventId)}`), event),
  }),
  tool({
    name: 'add_calendar_event',
    title: 'Add a Kalender event',
    description:
      'Adds an event to Kalender and its Google calendar. An Akademik event (category akademik, with the course id) needs the akademik role; any other category needs ring1.',
    write: true,
    input: {
      title: z.string().min(1),
      description: z.string().optional(),
      start: z
        .string()
        .describe('ISO date and time, for example 2026-10-08T09:00:00+07:00'),
      end: z.string().describe('ISO date and time, after start'),
      category: z.enum(['akademik', 'himpunan']),
      courseId: z
        .string()
        .optional()
        .describe('Required for an Akademik event'),
    },
    run: async (a, api) =>
      answer(await api('POST', '/calendar/event', { body: a }), event),
  }),
  tool({
    name: 'update_calendar_event',
    title: 'Change a Kalender event',
    description:
      'Changes a Kalender event’s title, description or times. Akademik events need the akademik role; others need ring1.',
    write: true,
    idempotent: true,
    input: {
      eventId: z.string().min(1),
      title: z.string().optional(),
      description: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
    },
    run: async ({ eventId, ...body }, api) =>
      answer(
        await api('PUT', `/calendar/event/${id(eventId)}`, { body }),
        event,
      ),
  }),
  tool({
    name: 'delete_calendar_event',
    title: 'Delete a Kalender event',
    description:
      'Deletes a Kalender event. Akademik events need the akademik role; others need ring1.',
    write: true,
    destructive: true,
    idempotent: true,
    input: { eventId: z.string().min(1) },
    run: async (a, api) =>
      answer(await api('DELETE', `/calendar/event/${id(a.eventId)}`), () => ({
        deleted: a.eventId,
      })),
  }),

  // Form
  tool({
    name: 'list_my_forms',
    title: 'My forms',
    description:
      'Forms sent to your angkatan, with whether each is open, not open yet, closed, or already answered, and which profile fields each sends along with an answer.',
    write: false,
    input: {},
    run: async (_a, api) =>
      answer(await api('GET', '/form'), (b) =>
        (b.forms as any[]).map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
          status: f.status,
          opensAt: f.opensAt,
          closesAt: f.closesAt,
          requestedFields: f.requestedFields,
          allowEdit: f.allowEdit,
        })),
      ),
  }),
  tool({
    name: 'get_form',
    title: 'Read a form',
    description:
      'A form with its sections and questions (only for its angkatan), the profile fields it sends along (requestedFields), and your answers if you sent them. Kinds: text, textarea, radio, checkbox, dropdown, rating (scale, 1 to 5 unless `scale` says), date (YYYY-MM-DD), time (HH:MM), file. A question with dependsOn is shown, and required, only when that answer was given. canChange says you may still change what you sent.',
    write: false,
    input: { formId: z.string().min(1) },
    run: async (a, api) => {
      const form = await api('GET', `/form/${id(a.formId)}`);
      if (form.status >= 400) return refusal(form);
      const mine = await api('GET', `/form/${id(a.formId)}/my-response`);
      return text({
        ...(form.body as object),
        myAnswers:
          mine.status < 400 ? ((mine.body as any)?.answers ?? null) : null,
      });
    },
  }),
  tool({
    name: 'submit_form',
    title: 'Send a form',
    description:
      "Sends your answers to a form, once, while it is open and only for its angkatan. Each answer names its question's id; a checkbox answer is a list; for \"Lainnya\" send `__other` as the choice and the words in `other`. A file question can't be answered here. When the form requests profile fields (get_form's requestedFields), set agreed to true only after the member said yes to sending exactly those; a saved detail they never gave must first be filled in the app (Profil › Data diri).",
    write: true,
    input: {
      formId: z.string().min(1),
      answers: formAnswers,
      agreed: z
        .boolean()
        .optional()
        .describe(
          'The member agreed to send the requested profile fields with their answers',
        ),
    },
    run: async (a, api) =>
      answer(
        await api('POST', `/form/${id(a.formId)}/response`, {
          body: { answers: a.answers, agreed: a.agreed },
        }),
        (r) => ({ id: r.id, submittedAt: r.submittedAt, sent: r.profile }),
      ),
  }),
  tool({
    name: 'change_form_answers',
    title: 'Change what you sent to a form',
    description:
      'Replaces your answers to a form you already sent, while it is open and its maker allows changes (get_form says canChange). Same rules as submit_form; send every answer again, not only the changed ones.',
    write: true,
    idempotent: true,
    input: {
      formId: z.string().min(1),
      answers: formAnswers,
      agreed: z.boolean().optional(),
    },
    run: async (a, api) =>
      answer(
        await api('PUT', `/form/${id(a.formId)}/response`, {
          body: { answers: a.answers, agreed: a.agreed },
        }),
        (r) => ({ id: r.id, updatedAt: r.updatedAt }),
      ),
  }),

  // Services
  tool({
    name: 'list_competitions',
    title: 'Info Lomba',
    description:
      'Competitions in Info Lomba, newest or by deadline. 10 per page.',
    write: false,
    input: {
      activeOnly: z
        .boolean()
        .optional()
        .describe('Only those whose registration is open'),
      sort: z.enum(['created', 'deadline']).optional(),
      category: z
        .enum([
          'Competitive Programming',
          'Capture The Flag',
          'Data Science / Data Analytics',
          'UI/UX',
          'Game Development',
          'Business IT Case',
          'Innovation',
          'Web Development',
        ])
        .optional(),
      offset,
    },
    run: async (a, api) =>
      answer(
        await api('GET', '/competitions', {
          query: {
            filter: a.activeOnly ? 'active' : undefined,
            sort: a.sort,
            category: a.category,
            offset: a.offset,
          },
        }),
        (b) =>
          (b.competitions as any[]).map((c) => ({
            id: c.id,
            name: c.name,
            organizer: c.organizer,
            registrationStart: c.registrationStart,
            registrationDeadline: c.registrationDeadline,
            price: c.price,
            categories: c.categories,
            registrationUrl: c.registrationUrl,
            sourceUrl: c.sourceUrl,
          })),
      ),
  }),
  tool({
    name: 'search_courses',
    title: 'Find a course',
    description:
      'Finds courses in the catalogue by name or code, major, semester or type, for Testi Matkul.',
    write: false,
    input: {
      search: z.string().max(100).optional(),
      major: z.enum(['IF', 'STI', 'OTHER']).optional(),
      semester: z
        .number()
        .int()
        .optional()
        .describe('0 for courses taken in any semester'),
      type: z.enum(['Mandatory', 'Elective']).optional(),
      curriculumYear: z.number().int().optional(),
    },
    run: async (a, api) =>
      answer(await api('GET', '/course', { query: a }), (b) =>
        ((b.courses ?? b) as any[]).map(course),
      ),
  }),
  tool({
    name: 'get_course_testimonials',
    title: 'Testi Matkul',
    description:
      'Testimonials older students wrote about a course (Testi Matkul). Authors who chose to stay anonymous stay so.',
    write: false,
    input: { courseId: z.string().min(1) },
    run: async (a, api) =>
      answer(await api('GET', `/testimoni/course/${id(a.courseId)}`)),
  }),
  tool({
    name: 'find_member',
    title: 'NIM Finder',
    description:
      'Finds members by name or NIM (at least 3 characters): name, NIM and major, at most 30.',
    write: false,
    input: { search: z.string().min(3).max(100) },
    run: async (a, api) =>
      answer(await api('GET', '/user/nim', { query: { search: a.search } })),
  }),

  // Kelola
  tool({
    name: 'add_testimonial',
    title: 'Add a Testi Matkul testimonial',
    description:
      'Adds a testimonial to a course in Testi Matkul. Needs the akademik role. IF courses use overview, assignments and lecturer_review; STI courses impressions, challenges and advice.',
    write: true,
    input: {
      courseId: z.string().min(1),
      userName: z
        .string()
        .optional()
        .describe('The name shown; leave out for Anonim'),
      lecturer: z.string().optional(),
      overview: z.string().optional(),
      assignments: z.string().optional(),
      lecturer_review: z.string().optional(),
      impressions: z.string().optional(),
      challenges: z.string().optional(),
      advice: z.string().optional(),
    },
    run: async (a, api) => answer(await api('POST', '/testimoni', { body: a })),
  }),
  tool({
    name: 'add_competition',
    title: 'Add a competition',
    description:
      'Adds a competition to Info Lomba. Needs the cnc role. Posters can’t be added here.',
    write: true,
    input: {
      name: z.string().min(3),
      organizer: z.string().min(3),
      registrationStart: z.string().optional().describe('ISO date and time'),
      registrationDeadline: z.string().optional().describe('ISO date and time'),
      price: z.string().optional(),
      sourceUrl: z.string(),
      registrationUrl: z.string(),
      categories: z.array(z.string()),
    },
    run: async (a, api) =>
      answer(await api('POST', '/competitions', { body: a })),
  }),
  tool({
    name: 'update_competition',
    title: 'Change a competition',
    description: 'Changes a competition in Info Lomba. Needs the cnc role.',
    write: true,
    idempotent: true,
    input: {
      competitionId: z.string().min(1),
      name: z.string().optional(),
      organizer: z.string().optional(),
      registrationStart: z.string().optional(),
      registrationDeadline: z.string().optional(),
      price: z.string().optional(),
      sourceUrl: z.string().optional(),
      registrationUrl: z.string().optional(),
      categories: z.array(z.string()).optional(),
    },
    run: async ({ competitionId, ...body }, api) =>
      answer(await api('PUT', `/competitions/${id(competitionId)}`, { body })),
  }),
  tool({
    name: 'delete_competition',
    title: 'Delete a competition',
    description: 'Deletes a competition from Info Lomba. Needs the cnc role.',
    write: true,
    destructive: true,
    idempotent: true,
    input: { competitionId: z.string().min(1) },
    run: async (a, api) =>
      answer(
        await api('DELETE', `/competitions/${id(a.competitionId)}`),
        () => ({
          deleted: a.competitionId,
        }),
      ),
  }),
  tool({
    name: 'list_forms_admin',
    title: 'Every form (Rekap Form)',
    description:
      'Every form, open or not, for Live Counting & Rekap Form. Needs the admin role.',
    write: false,
    input: {},
    run: async (_a, api) =>
      answer(await api('GET', '/form/admin/list'), (b) =>
        (b.forms as any[]).map((f) => ({
          id: f.id,
          title: f.title,
          eligibleAngkatan: f.eligibleAngkatan,
          opensAt: f.opensAt,
          closesAt: f.closesAt,
          isActive: f.isActive,
        })),
      ),
  }),
  tool({
    name: 'get_form_responses',
    title: 'Rekap Form responses',
    description:
      "A form's responses with each member's name and NIM, 20 per page. Needs the admin role.",
    write: false,
    input: {
      formId: z.string().min(1),
      search: z.string().max(100).optional().describe('A NIM or name'),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    run: async ({ formId, ...query }, api) =>
      answer(await api('GET', `/form/${id(formId)}/responses`, { query })),
  }),
  tool({
    name: 'get_form_analytics',
    title: 'Rekap Form summary',
    description:
      "A form's summary: how many answered, and the answers counted per question. Needs the admin role.",
    write: false,
    input: { formId: z.string().min(1) },
    run: async (a, api) => {
      const analytics = await api('GET', `/form/${id(a.formId)}/analytics`);
      if (analytics.status >= 400) return refusal(analytics);
      const count = await api('GET', `/form/${id(a.formId)}/responses/count`);
      return text({
        ...(count.status < 400 ? (count.body as object) : {}),
        ...(analytics.body as object),
      });
    },
  }),
  tool({
    name: 'list_managed_forms',
    title: 'Forms you manage (Kelola › Form)',
    description:
      'The forms you made and those shared with you, with their state, how many answered, and what you may do (access.canEdit). For pengurus; scope all lists every form and needs the admin role.',
    write: false,
    input: { scope: z.enum(['mine', 'all']).optional() },
    run: async (a, api) =>
      answer(
        await api('GET', '/form/manage/list', { query: { scope: a.scope } }),
        (b) =>
          (b.forms as any[]).map((f) => ({
            id: f.id,
            title: f.title,
            status: f.status,
            link: f.slug,
            responseCount: f.responseCount,
            owner: f.owner?.fullName,
            role: f.access.role,
            canEdit: f.access.canEdit,
          })),
      ),
  }),
  tool({
    name: 'get_form_summary',
    title: "A form's answers, summed up",
    description:
      "The Jawaban tab of a form you manage: how many answered out of its angkatan, and per question the counts, the mean of a scale, the text answers (newest 100) or the files. For the form's owner, the people it is shared with, and admin.",
    write: false,
    input: { formId: z.string().min(1) },
    run: async (a, api) =>
      answer(await api('GET', `/form/${id(a.formId)}/answers/summary`)),
  }),
  tool({
    name: 'create_form',
    title: 'Make a form (Kelola › Form)',
    description:
      'Makes a new draft form that you own, with one untitled section holding one multiple-choice question, requesting Nama and NIM. Members never see a draft. Shape it with update_form, then publish_form. For pengurus.',
    write: true,
    input: { title: z.string().max(200).optional() },
    run: async (a, api) =>
      answer(await api('POST', '/form', { body: { title: a.title } })),
  }),
  tool({
    name: 'get_managed_form',
    title: 'A form you manage',
    description:
      'A form as its builder sees it: title, sections and questions (with their ids), angkatan, opening and closing times, requested profile fields, its link name, state, how many answered out of its angkatan, and who it is shared with. For its owner, those it is shared with, and admin.',
    write: false,
    input: { formId: z.string().min(1) },
    run: async (a, api) => {
      const form = await api('GET', `/form/${id(a.formId)}/manage`);
      if (form.status >= 400) return refusal(form);
      const access = await api('GET', `/form/${id(a.formId)}/access`);
      return text({
        ...(form.body as object),
        sharedWith: access.status < 400 ? access.body : undefined,
      });
    },
  }),
  tool({
    name: 'update_form',
    title: 'Change a form',
    description:
      'Changes any of a form’s title, description, sections, angkatan, opening and closing times (ISO, or null), requested profile fields, the sent screen’s words (thanks) and whether members may change what they sent (allowEdit). Send only what changes; sections replace every section, so read get_managed_form first and keep each question’s id. Question kinds: text, textarea, radio, checkbox, dropdown, rating, date, time, file; a question may have options, optional, other ("Lainnya", radio and checkbox only), description, scale {min, max} and dependsOn {questionId, value}. To close a form now, set closesAt to the current time. If the form has answers and the change removes a question or changes its kind, the route answers 409 with what would be lost: tell the member, and send again with confirmBreaking true only after they agree, since those answers are deleted for good. For the owner, people with Edit, and admin.',
    write: true,
    idempotent: true,
    input: {
      formId: z.string().min(1),
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      sections: z
        .array(z.record(z.unknown()))
        .optional()
        .describe(
          'Every section: { id, title, description?, questions: [...] }',
        ),
      eligibleAngkatan: z.array(z.number().int()).optional(),
      opensAt: z.string().nullable().optional(),
      closesAt: z.string().nullable().optional(),
      requestedFields: z
        .array(
          z.enum([
            'fullName',
            'nim',
            'major',
            'angkatan',
            'campus',
            'email',
            'whatsapp',
            'line',
            'instagram',
            'address',
            'hometown',
            'emergencyContact',
            'health',
            'birthDate',
            'studentCardPhoto',
            'photo',
          ]),
        )
        .optional(),
      thanks: z.string().nullable().optional(),
      allowEdit: z.boolean().optional(),
      confirmBreaking: z.boolean().optional(),
    },
    run: async ({ formId, ...body }, api) =>
      answer(await api('PATCH', `/form/${id(formId)}`, { body })),
  }),
  tool({
    name: 'publish_form',
    title: 'Publish a form',
    description:
      'Publishes a draft form to its angkatan. It opens now unless an opening time was set. A form that isn’t ready answers 400 with its problems (no_title, no_questions, unwritten_question, one_option, no_angkatan, closes_before_opening, already_closed). For the owner, people with Edit, and admin.',
    write: true,
    input: { formId: z.string().min(1) },
    run: async (a, api) =>
      answer(await api('POST', `/form/${id(a.formId)}/publish`)),
  }),
  tool({
    name: 'rename_form_link',
    title: 'Change a form’s link',
    description:
      'Gives a form a new short name for its link (app.hmif.dev/f/<name>): lower case letters, numbers and single hyphens. The old link stops working at once. For the owner, people with Edit, and admin.',
    write: true,
    idempotent: true,
    input: { formId: z.string().min(1), slug: z.string().min(1).max(100) },
    run: async (a, api) =>
      answer(
        await api('PUT', `/form/${id(a.formId)}/slug`, {
          body: { slug: a.slug },
        }),
        (f) => ({ id: f.id, link: f.slug }),
      ),
  }),
  tool({
    name: 'find_form_collaborators',
    title: 'Find someone to share a form with',
    description:
      'Finds members by name or NIM (at least 3 characters) to share a form with, with whether each is pengurus (only pengurus can be added) and their current access. For the owner, people with Edit, and admin.',
    write: false,
    input: { formId: z.string().min(1), search: z.string().min(3).max(100) },
    run: async (a, api) =>
      answer(
        await api('GET', `/form/${id(a.formId)}/access/search`, {
          query: { search: a.search },
        }),
      ),
  }),
  tool({
    name: 'share_form',
    title: 'Share a form',
    description:
      'Shares a form with a pengurus, or changes what they may do: view sees the form and its answers, edit also changes it and who it is shared with. The ids come from find_form_collaborators. For the owner, people with Edit, and admin.',
    write: true,
    idempotent: true,
    input: {
      formId: z.string().min(1),
      userId: z.string().min(1),
      role: z.enum(['view', 'edit']),
    },
    run: async (a, api) =>
      answer(
        await api('PUT', `/form/${id(a.formId)}/access/${id(a.userId)}`, {
          body: { role: a.role },
        }),
      ),
  }),
  tool({
    name: 'unshare_form',
    title: 'Stop sharing a form',
    description:
      'Removes someone’s access to a form. The owner’s can’t be removed. For the owner, people with Edit, and admin.',
    write: true,
    destructive: true,
    idempotent: true,
    input: { formId: z.string().min(1), userId: z.string().min(1) },
    run: async (a, api) =>
      answer(
        await api('DELETE', `/form/${id(a.formId)}/access/${id(a.userId)}`),
      ),
  }),
];

/** Registers the tools `scope` allows: a token without `pips.write` sees and can call only the reading ones. */
export function registerTools(
  server: McpServer,
  api: ApiCall,
  canWrite: boolean,
) {
  for (const spec of TOOLS) {
    if (spec.write && !canWrite) continue;
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: spec.input,
        annotations: {
          title: spec.title,
          readOnlyHint: !spec.write,
          destructiveHint: spec.write ? Boolean(spec.destructive) : false,
          idempotentHint: spec.write ? Boolean(spec.idempotent) : true,
          openWorldHint: false,
        },
      },
      async (args: any) => await spec.run(args, api),
    );
  }
}
