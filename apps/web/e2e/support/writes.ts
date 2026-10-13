/**
 * Ready-made write handlers that behave like the API on the test's own data. None is installed by default:
 * a test opts in to each write it expects, e.g. `api.on('PUT /api/reaction', writes.react)`, so the guard still
 * catches any other write.
 */
import type {
  CommentWithReactions,
  DraftInternshipSubmission,
  FormAnswer,
  InternshipSubmission,
  ReactionAggregate,
} from '../../src/api/generated';
import {
  NOW,
  authorOf,
  formStatusFor,
  isSpartaEligible,
  spartaWindowFor,
  type Db,
} from '../fixtures/api';
import { reply, type Handler } from './mock';

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

/** POST /api/form/:formId/response — send the form once; 403 when it's closed or not open yet, as the API does. */
export const submitForm: Handler = ({ db, params, body }) => {
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
    submittedAt: NOW,
  };
  db.forms = db.forms.map((f) =>
    f.id === params.formId ? { ...f, status: 'already_responded' } : f,
  );
  return db.myResponses[params.formId];
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

// Magang SPARTA (as `apps/api/src/controllers/internship.controller.ts`).

function saveSparta(db: Db, body: unknown, submit: boolean) {
  if (!isSpartaEligible(db.me!))
    return reply.status(401, {
      error: 'You are not eligible to access SPARTA internship form',
    });
  if (spartaWindowFor(db).status !== 'open')
    return reply.status(403, {
      error: 'SPARTA is not taking applications now',
    });
  const data = body as DraftInternshipSubmission;
  const divisions = data.choices.map((c) => c.divisionId);
  const priorities = data.choices.map((c) => c.priorityOrder);
  const draftOk =
    data.choices.length <= 4 &&
    new Set(divisions).size === divisions.length &&
    new Set(priorities).size === priorities.length &&
    priorities.every((p) => p >= 1 && p <= 4);
  const strictOk =
    data.kelas.length > 0 &&
    data.idLine.length > 0 &&
    data.choices.length === 4;
  if (!draftOk || (submit && !strictOk))
    return reply.status(400, { error: 'Invalid submission' });
  const me = db.me!;
  const existing = db.internshipSubmissions.find((s) => s.userId === me.id);
  if (existing?.isLocked)
    return reply.status(409, { error: 'Submission is already locked' });
  const id = existing?.id ?? `sub-${me.nim}`;
  const saved: InternshipSubmission = {
    id,
    userId: me.id,
    nim: me.nim,
    fullName: me.fullName,
    jurusan: me.major,
    kelas: data.kelas,
    idLine: data.idLine,
    pengalamanOrganisasi: data.pengalamanOrganisasi ?? null,
    kesibukan: data.kesibukan ?? [],
    isLocked: submit,
    submittedAt: submit ? NOW : null,
    createdAt: existing?.createdAt ?? NOW,
    updatedAt: NOW,
    choices: data.choices.map((c, i) => ({
      id: `choice-${me.nim}-${i}`,
      submissionId: id,
      divisionId: c.divisionId,
      priorityOrder: c.priorityOrder,
      answers: c.answers,
    })),
  };
  db.internshipSubmissions = [
    ...db.internshipSubmissions.filter((s) => s.id !== id),
    saved,
  ];
  return saved;
}

/** PUT /api/internship/submission — save a draft (may be partial); 403 outside the window. */
export const saveSpartaDraft: Handler = ({ db, body }) =>
  saveSparta(db, body, false);

/** POST /api/internship/submission/submit — send and lock (all of it required); 403 outside the window. */
export const submitSparta: Handler = ({ db, body }) =>
  saveSparta(db, body, true);

/* ---- P1-C: courses, notification categories, push, sign-in and sign-out ---- */

/**
 * PUT /api/course/take/batch — `[{ courseId, class }]` into this semester. Like the API's upsert on
 * `(userId, courseId)`: a course already in the list only changes its class (and keeps its semester: the known
 * re-take bug, OPEN-QUESTIONS C2). 404 if a course doesn't exist.
 */
export const takeCourses: Handler = ({ db, body }) => {
  const picks = body as Array<{ courseId: string; class: number }>;
  if (picks.some((p) => !db.courses.some((c) => c.id === p.courseId)))
    return reply.json({ error: 'Some courses not found' }, 404);
  const rows = picks.map((p) => {
    const existing = db.myCourses.find((m) => m.courseId === p.courseId);
    if (existing) {
      existing.class = p.class;
      return existing;
    }
    const row = {
      userId: db.me!.id,
      courseId: p.courseId,
      class: p.class,
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
