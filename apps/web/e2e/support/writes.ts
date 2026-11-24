/**
 * Ready-made write handlers that behave like the API on the test's own data. None is installed by default:
 * a test opts in to each write it expects, e.g. `api.on('PUT /api/reaction', writes.react)`, so the guard still
 * catches any other write.
 */
import type {
  CalendarEvent,
  CommentWithReactions,
  Competition,
  FormAnswer,
  Info,
  ReactionAggregate,
  UpdateForm,
  Testimoni,
} from '../../src/api/generated';
import {
  DEFAULT_COURSE_CLASS,
  NOW,
  authorOf,
  formStatusFor,
  type Db,
  type StoredForm,
} from '../fixtures/api';
import {
  MAX_UPLOAD_BYTES,
  uploadContentType,
} from '../../../api/src/lib/upload-policy';
import { NEW_FORM_FIELDS } from '../../../api/src/lib/form-model';
import {
  definitionProblem,
  dropLostAnswers,
  findBreakingChanges,
  numberedSlug,
  publishProblems,
  slugFromTitle,
  slugProblem,
  tidySlug,
} from '../../../api/src/lib/form-rules';
import {
  detailsProblems,
  tidyChange,
  type DetailsChange,
} from '../../../api/src/lib/member-details';
import {
  checkSubmission,
  findForm,
  isPengurus,
  isStoredFile,
  loadForManage,
  manageView,
  myDetails,
  myResponse,
  notFound as formNotFound,
  pengurusIds,
  personOf,
  TODAY,
  accessList,
  viewOnly,
} from './forms';
import { reply, type Handler } from './mock';
import { shortLinkHolder } from './short-links';

function setReaction(
  agg: ReactionAggregate,
  next: string | null,
): ReactionAggregate {
  const counts = new Map(agg.reactionsCount.map((r) => [r.reaction, r.count]));
  if (agg.userReaction)
    counts.set(agg.userReaction, (counts.get(agg.userReaction) ?? 1) - 1);
  if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
  const reactionsCount = [...counts]
    .filter(([, c]) => c > 0)
    .map(([reaction, count]) => ({ reaction, count }));
  return {
    totalReactions: reactionsCount.reduce((n, r) => n + r.count, 0),
    reactionsCount,
    ...(next ? { userReaction: next } : {}),
  };
}

/** POST /api/info/:infoId/read — mark read or unread. */
export const markRead: Handler = ({ db, params, body }) => {
  const info = db.infos.find((i) => i.id === params.infoId);
  if (!info) return reply.status(404);
  info.isRead = !(body as { unread?: boolean } | undefined)?.unread;
  return { success: true };
};

/** POST /api/info/read-all — mark every post the member sees read (the fixture holds only those); how many. */
export const readAll: Handler = ({ db }) => {
  const unread = db.infos.filter((i) => !i.isRead);
  for (const i of unread) i.isRead = true;
  return { marked: unread.length };
};

/** PUT /api/reaction — react to a post or a comment (one reaction per person). */
export const react: Handler = ({ db, body }) => {
  const { reaction, infoId, commentId } = body as {
    reaction: string;
    infoId?: string;
    commentId?: string;
  };
  const target = commentId
    ? Object.values(db.comments)
        .flat()
        .find((c) => c.id === commentId)
    : db.infos.find((i) => i.id === infoId);
  if (!target) return reply.status(404);
  target.reactions = setReaction(target.reactions, reaction);
  return {
    id: `reaction-${infoId ?? commentId}`,
    creatorId: db.me!.id,
    infoId: infoId ?? null,
    commentId: commentId ?? null,
    reaction,
    createdAt: NOW,
  };
};

/** POST /api/comment — add a comment as the signed-in member. */
export const comment: Handler = ({ db, body }) => {
  const { content, repliedInfoId } = body as {
    content: string;
    repliedInfoId: string;
  };
  const list = (db.comments[repliedInfoId] ??= []);
  const created: CommentWithReactions = {
    id: `${repliedInfoId}-c${list.length + 1}`,
    repliedInfoId,
    creatorId: db.me!.id,
    content,
    createdAt: NOW,
    creator: authorOf(db.me!),
    reactions: { totalReactions: 0, reactionsCount: [] },
  };
  list.push(created);
  const info = db.infos.find((i) => i.id === repliedInfoId);
  if (info) info.comments += 1;
  return created;
};

/**
 * POST /api/form/:formId/response — send a form once; 403 when it's closed, not open yet or not for your angkatan,
 * 409 the second time, as the API does. A form made in the builder is checked as the API checks it: answers that fit,
 * required ones, and the agreement with every requested field (a detail filled in at the agreement step is saved to
 * `db.memberDetails` first).
 */
export const submitForm: Handler = ({ db, params, body }) => {
  const stored = findForm(db, params.formId);
  if (stored && !db.formDetails[params.formId]) {
    if (stored.publishedAt === null) return formNotFound();
    if (!stored.eligibleAngkatan.includes(db.me!.angkatan))
      return reply.status(403, { error: 'You are not eligible for this form' });
    const window = {
      opensAt: stored.opensAt!,
      closesAt: stored.closesAt,
      isActive: stored.isActive,
    };
    const status = formStatusFor(window, { responded: false, nim: db.me!.nim });
    if (status === 'closed')
      return reply.status(403, { error: 'This form is closed' });
    if (status === 'not_opened')
      return reply.status(403, { error: 'This form has not opened yet' });
    const checked = checkSubmission(db, stored, body as never);
    if ('error' in checked) return checked.error;
    if (myResponse(db, stored))
      return reply.status(409, {
        error: 'Already submitted a response for this form',
      });
    if (checked.change)
      db.memberDetails = { ...db.memberDetails, ...checked.change };
    const response = {
      id: `response-${stored.id}`,
      userId: db.me!.id,
      answers: checked.answers,
      profile: checked.profile,
      submittedAt: NOW,
      updatedAt: null,
    };
    stored.responses.push(response);
    return reply.json({ ...response, formId: stored.id }, 201);
  }
  const form = db.formDetails[params.formId];
  if (form) {
    const status = formStatusFor(form, { responded: false, nim: db.me!.nim });
    if (status === 'closed')
      return reply.status(403, { error: 'This form is closed' });
    if (status === 'not_opened')
      return reply.status(403, { error: 'This form has not opened yet' });
  }
  if (db.myResponses[params.formId])
    return reply.status(409, { error: 'Already responded' });
  const answers = (body as { answers: FormAnswer[] }).answers;
  db.myResponses[params.formId] = {
    id: `response-${params.formId}`,
    formId: params.formId,
    userId: db.me!.id,
    answers,
    profile: {},
    submittedAt: NOW,
    updatedAt: null,
  };
  db.forms = db.forms.map((f) =>
    f.id === params.formId ? { ...f, status: 'already_responded' } : f,
  );
  return db.myResponses[params.formId];
};

/** PUT /api/form/:formId/response — Ubah jawaban: only with an answer to change, while open, when the maker allows it. */
export const changeFormResponse: Handler = ({ db, params, body }) => {
  const form = findForm(db, params.formId);
  if (!form || form.publishedAt === null) return formNotFound();
  const mine = myResponse(db, form);
  if (!mine) return reply.status(404, { error: 'No response to change' });
  if (!form.allowEdit)
    return reply.status(403, { error: 'This form does not allow changes' });
  const window = {
    opensAt: form.opensAt!,
    closesAt: form.closesAt,
    isActive: form.isActive,
  };
  if (
    !form.eligibleAngkatan.includes(db.me!.angkatan) ||
    formStatusFor(window, { responded: false, nim: db.me!.nim }) !== 'open'
  )
    return reply.status(403, { error: 'This form is closed' });
  const checked = checkSubmission(db, form, body as never);
  if ('error' in checked) return checked.error;
  if (checked.change)
    db.memberDetails = { ...db.memberDetails, ...checked.change };
  Object.assign(mine, {
    answers: checked.answers,
    profile: checked.profile,
    updatedAt: NOW,
  });
  return { ...mine, formId: form.id };
};

/** PATCH /api/user/details — Data diri: a value sets a detail, null removes it; 400 with `problems` as the API says them. */
export const updateMyDetails: Handler = ({ db, body }) => {
  const change = tidyChange(body as DetailsChange);
  const problems = detailsProblems(change, { today: TODAY, isStoredFile });
  if (Object.keys(problems).length)
    return reply.status(400, {
      error: 'A saved detail does not fit',
      problems,
    });
  db.memberDetails = { ...db.memberDetails, ...change };
  return myDetails(db);
};

// The form builder, as `apps/api/src/controllers/form-manage.controller.ts`: pengurus only (401 "Unauthorized"
// otherwise), 404 for a form they may not see, 403 for Lihat jawaban trying to change it.

let newForms = 0;
const asPengurus = (db: Db) => isPengurus(db);
const freeSlugFor = (db: Db, title: string, formId: string | null) => {
  const base = slugFromTitle(title);
  for (let n = 1; ; n++) {
    const slug = numberedSlug(base, n);
    if (!db.formStore.some((f) => f.slug === slug && f.id !== formId))
      return slug;
  }
};
function editable(db: Db, formId: string) {
  if (!asPengurus(db)) return { error: unauthorized() };
  const found = loadForManage(db, formId);
  if (!found) return { error: formNotFound() };
  if (!found.access.canEdit) return { error: viewOnly() };
  return { form: found.form };
}

/** POST /api/form — Buat form: a draft you own, one question ready, Nama and NIM ticked; 201. */
export const createForm: Handler = ({ db, body }) => {
  if (!asPengurus(db)) return unauthorized();
  const title = ((body as { title?: string } | undefined)?.title ?? '').trim();
  const n = ++newForms;
  const form: StoredForm = {
    id: `form-new-${n}`,
    slug: freeSlugFor(db, title, null),
    slugCustom: false,
    title,
    description: null,
    sections: [
      {
        id: `s-new-${n}`,
        title: '',
        questions: [
          { id: `q-new-${n}`, label: '', type: 'radio', options: ['Opsi 1'] },
        ],
      },
    ],
    requestedFields: [...NEW_FORM_FIELDS],
    eligibleAngkatan: [],
    opensAt: null,
    closesAt: null,
    isActive: false,
    allowEdit: false,
    thanks: null,
    publishedAt: null,
    ownerId: db.me!.id,
    shared: [],
    responses: [],
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
  db.formStore.unshift(form);
  return reply.json(manageView(db, form), 201);
};

/**
 * PATCH /api/form/:formId — saves the builder's changes. 400 for a definition that doesn't fit; 409 with `breaking`
 * when the edit takes away answers, until `confirmBreaking`; then those answers go.
 */
export const updateForm: Handler = ({ db, params, body }) => {
  const found = editable(db, params.formId);
  if ('error' in found) return found.error;
  const form = found.form;
  const { confirmBreaking, opensAt, closesAt, ...rest } = body as UpdateForm;
  if (rest.sections) {
    const problem = definitionProblem(rest.sections);
    if (problem) return reply.status(400, { error: problem });
  }
  const published = form.publishedAt !== null;
  if (published && rest.eligibleAngkatan?.length === 0)
    return reply.status(400, { error: 'A published form needs an angkatan' });
  if (published && opensAt === null)
    return reply.status(400, { error: 'A published form has an opening time' });
  const nextOpens = opensAt === undefined ? form.opensAt : opensAt;
  const nextCloses = closesAt === undefined ? form.closesAt : closesAt;
  if (
    nextOpens &&
    nextCloses &&
    Date.parse(nextCloses) <= Date.parse(nextOpens)
  )
    return reply.status(400, { error: 'Closes before it opens' });
  const breaking = rest.sections
    ? findBreakingChanges(form.sections, rest.sections)
    : [];
  if (breaking.length && form.responses.length && !confirmBreaking)
    return reply.status(409, {
      error: 'This edit takes answers away',
      breaking,
      responseCount: form.responses.length,
    });
  if (breaking.length)
    for (const r of form.responses)
      r.answers = dropLostAnswers(r.answers, breaking);
  Object.assign(form, rest, {
    ...(rest.title !== undefined ? { title: rest.title.trim() } : {}),
    opensAt: nextOpens,
    closesAt: nextCloses,
    updatedAt: NOW,
  });
  if (!published && !form.slugCustom && rest.title !== undefined)
    form.slug = freeSlugFor(db, form.title, form.id);
  return manageView(db, form);
};

/** POST /api/form/:formId/publish — 400 with `problems`, 409 when already published; opens now unless set. */
export const publishForm: Handler = ({ db, params }) => {
  const found = editable(db, params.formId);
  if ('error' in found) return found.error;
  const form = found.form;
  if (form.publishedAt !== null)
    return reply.status(409, { error: 'Already published' });
  const problems = publishProblems(form, Date.parse(NOW));
  if (problems.length)
    return reply.status(400, { error: 'Not ready to publish', problems });
  Object.assign(form, {
    publishedAt: NOW,
    isActive: true,
    opensAt: form.opensAt ?? NOW,
    slug: form.slugCustom ? form.slug : freeSlugFor(db, form.title, form.id),
    updatedAt: NOW,
  });
  return manageView(db, form);
};

/** DELETE /api/form/:formId — the form and its answers; 204. */
export const deleteForm: Handler = ({ db, params }) => {
  const found = editable(db, params.formId);
  if ('error' in found) return found.error;
  db.formStore = db.formStore.filter((f) => f !== found.form);
  return reply.text('', 204);
};

/** PUT /api/form/:formId/slug — 400 with `problem` for a name the link can't have, 409 when another form holds it (without capitals). */
export const renameFormSlug: Handler = ({ db, params, body }) => {
  const found = editable(db, params.formId);
  if ('error' in found) return found.error;
  const slug = tidySlug((body as { slug: string }).slug);
  const problem = slugProblem(slug);
  if (problem) return reply.status(400, { error: 'Not a short name', problem });
  const held = shortLinkHolder(db, slug, `form-${found.form.id}`);
  if (held) return reply.status(409, { error: 'The name is held', ...held });
  Object.assign(found.form, { slug, slugCustom: true, updatedAt: NOW });
  return manageView(db, found.form);
};

/** PUT /api/form/:formId/access/:userId — share with a pengurus or change their role; never the owner (400). */
export const setFormAccess: Handler = ({ db, params, body }) => {
  const found = editable(db, params.formId);
  if ('error' in found) return found.error;
  const { userId } = params;
  if (userId === found.form.ownerId)
    return reply.status(400, { error: "The owner's access never changes" });
  if (!personOf(db, userId))
    return reply.status(404, { error: 'No such member' });
  if (!pengurusIds().includes(userId))
    return reply.status(400, { error: 'Only pengurus can be added' });
  const role = (body as { role: 'view' | 'edit' }).role;
  const row = found.form.shared.find((s) => s.userId === userId);
  if (row) row.role = role;
  else found.form.shared.push({ userId, role });
  return accessList(db, found.form);
};

/** DELETE /api/form/:formId/access/:userId — Hapus akses; never the owner (400). */
export const removeFormAccess: Handler = ({ db, params }) => {
  const found = editable(db, params.formId);
  if ('error' in found) return found.error;
  if (params.userId === found.form.ownerId)
    return reply.status(400, { error: 'The owner can never be removed' });
  found.form.shared = found.form.shared.filter(
    (s) => s.userId !== params.userId,
  );
  return accessList(db, found.form);
};

// Curhat Yuk! (as `apps/api/src/controllers/curhat.controller.ts`; `db.chatrooms` holds only your rooms).

/** POST /api/curhat/chatroom — start a room; a fourth is refused with 400. The server names it. */
export const createRoom: Handler = ({ db }) => {
  const rooms = Object.values(db.chatrooms).filter((r) => r.canDelete);
  if (rooms.length >= 3)
    return reply.status(400, {
      error: 'You have reached the maximum chatrooms limit',
    });
  const id = `e2e-room-${Object.keys(db.chatrooms).length + 1}`;
  db.chatrooms[id] = {
    id,
    title: 'lime otter',
    messages: [],
    canDelete: true,
  };
  return reply.status(201, db.chatrooms[id]);
};

/** POST /api/curhat/chatroom/:chatroomId/read — mark the room's messages from others read; safe to repeat. */
export const readRoom: Handler = ({ db, params }) => {
  const room = db.chatrooms[params.chatroomId];
  if (!room) return reply.status(404, { error: 'Chatroom not found' });
  for (const m of room.messages ?? [])
    if (!m.isSender && !db.chatroomReads.includes(m.id))
      db.chatroomReads.push(m.id);
  return { message: 'Chatroom messages read' };
};

/** DELETE /api/curhat/chatroom/:chatroomId — the owner deletes a room and its messages. */
export const deleteRoom: Handler = ({ db, params }) => {
  const room = db.chatrooms[params.chatroomId];
  if (!room) return reply.status(404, { error: 'Chatroom not found' });
  if (!room.canDelete) return reply.status(401, { error: 'Unauthorized' });
  delete db.chatrooms[params.chatroomId];
  return { message: 'Chatroom deleted' };
};

/**
 * PUT /api/curhat/chatroom/:chatroomId/pin — Welfare pins or unpins a room for themselves; 401 without
 * `curhatadmin`, as the controller answers a missing role.
 */
export const pinRoom: Handler = ({ db, params, body }) => {
  if (!db.me?.roles.includes('curhatadmin'))
    return reply.status(401, { error: 'Unauthorized' });
  const isPinned = (body as { isPinned?: unknown } | null)?.isPinned;
  if (typeof isPinned !== 'boolean')
    return reply.status(400, { error: 'isPinned is required' });
  const room = db.chatrooms[params.chatroomId];
  if (!room) return reply.status(400, { error: 'Failed to pin chatroom' });
  room.isPinned = isPinned;
  return { message: isPinned ? 'Chatroom pinned' : 'Chatroom unpinned' };
};

/* ---- Courses, notification categories, push, sign-in and sign-out ---- */

/**
 * PUT /api/course/take/batch — `[{ courseId, class? }]` into this semester, as the API: a missing class is stored as
 * the default class (the app sends none; an older client's class is kept). Like the API's upsert on
 * `(userId, courseId)`, a course already in the list takes the new class and moves to this semester.
 * 404 if a course doesn't exist; 400 if a class isn't a number.
 */
export const takeCourses: Handler = ({ db, body }) => {
  const picks = body as Array<{ courseId: string; class?: unknown }>;
  if (picks.some((p) => p.class !== undefined && typeof p.class !== 'number'))
    return reply.json({ error: 'class must be a number' }, 400);
  if (picks.some((p) => !db.courses.some((c) => c.id === p.courseId)))
    return reply.json({ error: 'Some courses not found' }, 404);
  const rows = picks.map((p) => {
    const kelas = (p.class as number | undefined) ?? DEFAULT_COURSE_CLASS;
    const existing = db.myCourses.find((m) => m.courseId === p.courseId);
    if (existing) {
      existing.class = kelas;
      existing.semesterCodeTaken = db.academic.semesterCode;
      existing.semesterYearTaken = db.academic.semesterYear;
      return existing;
    }
    const row = {
      userId: db.me!.id,
      courseId: p.courseId,
      class: kelas,
      semesterCodeTaken: db.academic.semesterCode,
      semesterYearTaken: db.academic.semesterYear,
      course: db.courses.find((c) => c.id === p.courseId)!,
    };
    db.myCourses.push(row);
    return row;
  });
  return reply.json(
    rows.map(({ course: _course, ...r }) => r),
    201,
  );
};

/** DELETE /api/course/take/batch — `{ courseIds }`; answers with the rows removed. */
export const dropCourses: Handler = ({ db, body }) => {
  const { courseIds } = body as { courseIds: string[] };
  const removed = db.myCourses.filter((m) => courseIds.includes(m.courseId));
  db.myCourses = db.myCourses.filter((m) => !courseIds.includes(m.courseId));
  return removed.map(({ course: _course, ...r }) => r);
};

/** POST /api/unsubscribe/category — mutes a category's notifications; 400 for a required or unknown one. */
export const muteCategory: Handler = ({ db, body }) => {
  const { categoryId } = body as { categoryId: string };
  const category = db.categories.find((c) => c.id === categoryId);
  if (!category)
    return reply.json(
      { error: `Category with id ${categoryId} does not exist!` },
      400,
    );
  if (category.requiredPush)
    return reply.json(
      {
        error: `Subscription to category with id '${categoryId}' is required!`,
      },
      400,
    );
  if (!db.mutedCategoryIds.includes(categoryId))
    db.mutedCategoryIds.push(categoryId);
  return reply.json({ userId: db.me!.id, categoryId }, 201);
};

/** DELETE /api/unsubscribe/category — unmutes; 400 if it wasn't muted or doesn't exist. */
export const unmuteCategory: Handler = ({ db, body }) => {
  const { categoryId } = body as { categoryId: string };
  if (!db.categories.some((c) => c.id === categoryId))
    return reply.json(
      { error: `Category with id ${categoryId} does not exist!` },
      400,
    );
  if (!db.mutedCategoryIds.includes(categoryId))
    return reply.json(
      { error: 'User is already subscribed to that category!' },
      400,
    );
  db.mutedCategoryIds = db.mutedCategoryIds.filter((id) => id !== categoryId);
  return reply.json({ userId: db.me!.id, categoryId }, 201);
};

/** POST /api/push/register — links this device's subscription to the member. */
export const registerPush: Handler = ({ db, body }) => {
  const sub = body as Db['pushSubscriptions'][number];
  db.pushSubscriptions = [
    ...db.pushSubscriptions.filter((s) => s.endpoint !== sub.endpoint),
    sub,
  ];
  return reply.json({}, 201);
};

/** PUT /api/push/logout — unlinks a device (no session needed, as the API's public route). */
export const logoutPush: Handler = ({ db, body }) => {
  const { endpoint } = body as { endpoint: string };
  db.pushSubscriptions = db.pushSubscriptions.filter(
    (s) => s.endpoint !== endpoint,
  );
  return {};
};

/** POST /api/logout — the session cookie goes. */
export const logout: Handler = ({ db }) => {
  db.signedIn = false;
  return {};
};

/** POST /api/auth/login/accesstoken — Google's token accepted: the member is signed in (the JWT payload). */
export const loginAccessToken: Handler = ({ db }) => {
  if (!db.me) return reply.json({ error: 'User not found in database' }, 401);
  db.signedIn = true;
  return db.me;
};

/** POST /api/auth/login/accesstoken — an account that isn't on HMIF's member list (or isn't an std account). */
export const loginNotAMember: Handler = () =>
  reply.json({ error: 'User not found in database' }, 401);

/** POST /api/auth/login/accesstoken — the server failed. */
export const loginServerError: Handler = () =>
  reply.json({ error: 'e2e: server error' }, 500);

// Pengumuman, as `apps/api/src/controllers/{info,comment,reaction,media}.controller.ts`.

const isModerator = (db: Db) => db.me!.roles.includes('admin');
const allComments = (db: Db) => Object.values(db.comments).flat();

/** POST /api/info — post as the signed-in member; 403 for a category closed to them, 400 for an unknown one. */
export const createInfo: Handler = ({ db, body }) => {
  const b = body as {
    title: string;
    content: string;
    forCategories: string[];
    forAngkatan?: string[];
    forGroups?: string[];
    mediaUrls?: string[];
  };
  const cats = b.forCategories.map((id) =>
    db.categories.find((c) => c.id === id),
  );
  if (cats.some((c) => !c))
    return reply.status(400, { error: 'Unknown category' });
  if (cats.some((c) => !db.postableCategories.some((p) => p.id === c!.id)))
    return reply.status(403, { error: 'You may not post in this category' });
  const me = db.me!;
  const id = `e2e-info-${db.infos.length + 1}`;
  const info: Info = {
    id,
    creatorId: me.id,
    title: b.title,
    content: b.content,
    createdAt: NOW,
    lastNotifiedAt: NOW,
    infoMedias: (b.mediaUrls ?? []).map((url, i) => ({
      infoId: id,
      mediaId: `${id}-media-${i}`,
      order: i,
      media: {
        id: `${id}-media-${i}`,
        creatorId: me.id,
        name: url.split('/').pop() ?? url,
        type: 'image/svg+xml',
        url,
        createdAt: NOW,
      },
    })),
    infoCategories: cats.map((c) => ({
      infoId: id,
      categoryId: c!.id,
      category: c!,
    })),
    infoCourses: [],
    infoAngkatan: (b.forAngkatan ?? []).map((angkatanId) => ({
      infoId: id,
      angkatanId,
      angkatan: db.angkatan.find((a) => a.id === angkatanId)!,
    })),
    infoGroups: (b.forGroups ?? []).map((role) => ({
      role,
      group: db.groups.find((g) => g.role === role)?.group ?? role,
    })),
    comments: 0,
    reactions: { totalReactions: 0, reactionsCount: [] },
    creator: authorOf(me),
    // The API doesn't mark a new post read for its author; the app does (POST …/read).
    isRead: false,
    canNotify: false,
    isForAngkatan: !!b.forAngkatan?.length,
    isForGroups: !!b.forGroups?.length,
  };
  db.infos.unshift(info);
  db.comments[id] = [];
  // POST /api/info answers the post without its author, comment count or reactions.
  const created: Partial<Info> = { ...info };
  delete created.creator;
  delete created.comments;
  delete created.reactions;
  return created;
};

/** DELETE /api/info/:infoId — the author or `admin`; others 403; 404 when it's gone. */
export const deleteInfo: Handler = ({ db, params }) => {
  const info = db.infos.find((i) => i.id === params.infoId);
  if (!info) return reply.status(404, { error: 'Info not found' });
  if (info.creatorId !== db.me!.id && !isModerator(db))
    return reply.status(403, { error: 'Forbidden' });
  db.infos = db.infos.filter((i) => i.id !== params.infoId);
  return {};
};

/** POST /api/info/:infoId/renotify — the author only; 400 until 3 hours after the last notification. */
export const renotify: Handler = ({ db, params }) => {
  const info = db.infos.find((i) => i.id === params.infoId);
  if (!info) return reply.status(404, { error: 'Info not found' });
  if (info.creatorId !== db.me!.id)
    return reply.status(403, { error: 'Forbidden' });
  if (Date.parse(NOW) - Date.parse(info.lastNotifiedAt) < 3 * 36e5)
    return reply.status(400, {
      error: 'Info was notified less than 3 hours ago',
    });
  info.lastNotifiedAt = NOW;
  info.canNotify = false;
  return {};
};

/** DELETE /api/comment/:commentId — the author or `admin`; 404 when it's gone. */
export const deleteComment: Handler = ({ db, params }) => {
  const c = allComments(db).find((x) => x.id === params.commentId);
  if (!c) return reply.status(404, { error: 'Comment not found' });
  if (c.creatorId !== db.me!.id && !isModerator(db))
    return reply.status(403, { error: 'Forbidden' });
  db.comments[c.repliedInfoId] = db.comments[c.repliedInfoId].filter(
    (x) => x.id !== c.id,
  );
  const info = db.infos.find((i) => i.id === c.repliedInfoId);
  if (info) info.comments = Math.max(0, info.comments - 1);
  return c;
};

/** DELETE /api/reaction/info/:infoId and /api/reaction/comment/:commentId — remove your reaction. */
export const unreact: Handler = ({ db, params }) => {
  const target = params.commentId
    ? allComments(db).find((c) => c.id === params.commentId)
    : db.infos.find((i) => i.id === params.infoId);
  if (!target?.reactions.userReaction)
    return reply.status(404, { error: 'Reaction not found' });
  target.reactions = setReaction(target.reactions, null);
  return {};
};

let uploads = 0;
/**
 * POST /api/media/upload — an upload address on the mock's own `/__e2e__/upload/` (support/mock.ts answers the PUT,
 * with `api.uploads` for a delay or a failure) and the image's address once uploaded. The key is built as
 * `media.controller.ts` builds it, `<id>-<fileName>.<fileType>`, and the image is served with that type swapped for
 * `.svg`. A name or type carrying a dot or a slash (a MIME type such as "image/png") leaves an address no image is
 * served at, as the real API then can't save the post or competition that links it (media.repo.ts).
 */
export const presign: Handler = ({ body }) => {
  const { fileName, fileType, fileSize } = body as {
    fileName: string;
    fileType: string;
    fileSize: number;
  };
  // Refused as the API refuses (its own policy, lib/upload-policy.ts): a type outside the list, a size past 25 MiB.
  const contentType = uploadContentType(fileType);
  if (!contentType)
    return reply.status(400, { error: 'File type not allowed' });
  if (!(
    Number.isInteger(fileSize) &&
    fileSize > 0 &&
    fileSize <= MAX_UPLOAD_BYTES
  ))
    return reply.status(400, {
      errors: { formErrors: [], fieldErrors: { fileSize: ['Too big'] } },
    });
  const n = ++uploads;
  const key = `upload-${n}-${fileName}.${fileType}`;
  return {
    presignedUrl: `/__e2e__/upload/${key}`,
    mediaUrl: `/__e2e__/media/${key.replace(/\.[a-z0-9]+$/, '')}.svg`,
    expiresIn: 60,
    // As the API answers: the type the upload is signed for.
    contentType,
  };
};

// Managing events, competitions and testimonials, as `apps/api/src/controllers/{calendar,competitions,
// testimoni}.controller.ts`. Events check the role by category and answer 403; competitions (`cnc`) and
// testimonials (`akademik`) sit behind roleMiddleware, which answers 401 "Unauthorized".

const hasRole = (db: Db, role: string) =>
  (db.me!.roles as string[]).includes(role);
const eventRole = (category: string) =>
  category === 'akademik' ? 'akademik' : 'ring1';
const forbidden = () =>
  reply.status(403, { error: 'You are not allowed to manage this event' });
const unauthorized = () => reply.status(401, { error: 'Unauthorized' });
const endsBeforeStart = (start: string, end: string) =>
  Date.parse(end) < Date.parse(start);

/**
 * POST /api/calendar/event — 201 with the event and its Google Calendar link. `akademik` events need the role and a
 * course with a calendar group; `himpunan` events need `ring1`. It joins `db.events` (GET /api/calendar/me) when it
 * is in your own calendar: Himpunan, or one of your courses.
 */
export const createEvent: Handler = ({ db, body }) => {
  const b = body as {
    title: string;
    description?: string;
    start: string;
    end: string;
    category: 'akademik' | 'himpunan';
    courseId?: string;
  };
  if (!hasRole(db, eventRole(b.category))) return forbidden();
  if (b.category === 'akademik' && !b.courseId)
    return reply.status(400, { error: 'Course ID is required' });
  if (endsBeforeStart(b.start, b.end))
    return reply.status(400, { error: 'The event ends before it starts' });
  const course =
    b.category === 'akademik'
      ? db.courses.find((c) => c.id === b.courseId)
      : null;
  if (b.category === 'akademik' && !course)
    return reply.status(404, { error: 'Calendar group not found' });
  const id = `e2e-event-${db.events.length + 1}-${Date.parse(b.start)}`;
  const event: CalendarEvent = {
    id,
    calendarGroupId: course ? `group-${course.code}` : 'group-himpunan',
    courseId: course?.id ?? null,
    title: b.title,
    description: b.description ?? '',
    category: b.category,
    academicYear: db.academic.semesterYear,
    academicSemesterCode: db.academic.semesterCode,
    start: b.start,
    end: b.end,
    googleCalendarUrl: `https://calendar.google.com/calendar/event?eid=${id}`,
    googleCalendarId: id,
    synced: false,
    allDay: false,
    location: null,
  };
  if (!course || db.myCourses.some((m) => m.courseId === course.id))
    db.events.push(event);
  return reply.json(event, 201);
};

/** PUT /api/calendar/event/:eventId — title, description, start and end; the role of the event's category. */
export const updateEvent: Handler = ({ db, params, body }) => {
  const event = db.events.find((e) => e.id === params.eventId);
  if (!event) return reply.status(404, { error: 'Event not found' });
  if (!hasRole(db, eventRole(event.category))) return forbidden();
  const b = body as Partial<
    Pick<CalendarEvent, 'title' | 'description' | 'start' | 'end'>
  >;
  const next = { ...event, ...b };
  if (endsBeforeStart(next.start, next.end))
    return reply.status(400, { error: 'The event ends before it starts' });
  Object.assign(event, b);
  return { ...event };
};

/** DELETE /api/calendar/event/:eventId — 204; the role of the event's category. */
export const deleteEvent: Handler = ({ db, params }) => {
  const event = db.events.find((e) => e.id === params.eventId);
  if (!event) return reply.status(404, { error: 'Event not found' });
  if (!hasRole(db, eventRole(event.category))) return forbidden();
  db.events = db.events.filter((e) => e.id !== event.id);
  return reply.text('', 204);
};

/** A competition's posters from `mediaUrls`, in order, as `competitions.repo.ts` links them. */
function posterMedias(
  competitionId: string,
  urls: string[],
): NonNullable<Competition['medias']> {
  return urls.map((url, order) => {
    const file = url.split('/').at(-1)!;
    const [name, type] = file.split('.');
    const mediaId = `${competitionId}-media-${order}`;
    return {
      competitionId,
      mediaId,
      order,
      media: {
        id: mediaId,
        creatorId: 'user-cnc',
        name,
        type: type ?? '',
        url,
        createdAt: NOW,
      },
    };
  });
}

/** POST /api/competitions — `cnc`; 201 with the competition, its poster linked when `mediaUrls` has one. */
export const createCompetition: Handler = ({ db, body }) => {
  if (!hasRole(db, 'cnc')) return unauthorized();
  const b = body as Omit<Competition, 'id' | 'createdAt' | 'medias'>;
  const { mediaUrls, ...fields } = b as typeof b & { mediaUrls?: string[] };
  const id = `e2e-competition-${db.competitions.length + 1}`;
  const competition: Competition = {
    ...fields,
    id,
    createdAt: NOW,
    medias: posterMedias(id, mediaUrls ?? []),
  };
  db.competitions.push(competition);
  return reply.json(competition, 201);
};

/**
 * PUT /api/competitions/:id — `cnc`; the fields sent replace the stored ones (a sent `mediaUrls` replaces the posters,
 * `[]` removes them).
 * As the API: 400 for an empty body (nothing to change) and for a name or organiser under 3 characters.
 */
export const updateCompetition: Handler = ({ db, params, body }) => {
  if (!hasRole(db, 'cnc')) return unauthorized();
  const sent = body as Partial<Competition> & { mediaUrls?: string[] };
  const short = (['name', 'organizer'] as const).find(
    (k) => sent[k] !== undefined && String(sent[k]).length < 3,
  );
  if (short)
    return reply.status(400, {
      error: `${short === 'name' ? 'Name' : 'Organizer'} must be at least 3 characters`,
    });
  const c = db.competitions.find((x) => x.id === params.id);
  if (Object.keys(sent).length === 0)
    return reply.status(400, { error: 'Nothing to update' });
  if (!c) return reply.status(404, { error: 'Competition not found' });
  const { mediaUrls, ...rest } = sent;
  Object.assign(c, rest);
  if (mediaUrls) c.medias = posterMedias(c.id, mediaUrls);
  return { ...c };
};

/** DELETE /api/competitions/:competitionId — `cnc`; 200 with the deleted competition. */
export const deleteCompetition: Handler = ({ db, params }) => {
  if (!hasRole(db, 'cnc')) return unauthorized();
  const c = db.competitions.find((x) => x.id === params.competitionId);
  if (!c) return reply.status(404, { error: 'Competition not found' });
  db.competitions = db.competitions.filter((x) => x.id !== c.id);
  return { ...c };
};

/** POST /api/testimoni — `akademik` only (not `admin`); 200 with the testimonial (no `userId`, as the API), last in its course's list. */
export const createTestimonial: Handler = ({ db, body }) => {
  if (!hasRole(db, 'akademik')) return unauthorized();
  const b = body as Partial<Testimoni> & { courseId: string };
  const blank = {
    userName: null,
    impressions: null,
    challenges: null,
    advice: null,
    overview: null,
    assignments: null,
    lecturer_review: null,
    lecturer: null,
  };
  const t: Testimoni = {
    ...blank,
    ...b,
    id: `e2e-testimoni-${db.testimonials.length + 1}`,
    createdAt: NOW,
  };
  db.testimonials.push(t);
  return t;
};
