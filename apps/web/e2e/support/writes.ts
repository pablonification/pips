/**
 * Ready-made write handlers that behave like the API on the test's own data. None is installed by default:
 * a test opts in to each write it expects, e.g. `api.on('PUT /api/reaction', writes.react)`, so the guard still
 * catches any other write.
 */
import type {
  CommentWithReactions,
  DraftInternshipSubmission,
  FormAnswer,
  Info,
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

// Pengumuman (P1-B), as `apps/api/src/controllers/{info,comment,reaction,media}.controller.ts`.

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
 * with `api.uploads` for a delay or a failure) and the photo's address once uploaded.
 */
export const presign: Handler = ({ body }) => {
  const { fileName } = body as { fileName: string; fileType: string };
  const n = ++uploads;
  const name = `upload-${n}-${fileName.replace(/[^\w.-]/g, '_')}`;
  return {
    presignedUrl: `/__e2e__/upload/${name}`,
    mediaUrl: `/__e2e__/media/${name.replace(/\.[^.]+$/, '')}.svg`,
    expiresIn: 60,
  };
};
