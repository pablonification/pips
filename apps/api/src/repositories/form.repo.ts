import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';
import { Database } from '~/db/drizzle';
import { firstSure } from '~/db/helper';
import {
  formCollaborators,
  forms,
  formResponses,
  FormSection,
  memberDetails,
  userRoles,
  users,
} from '~/db/schema';
import type {
  CollaboratorRole,
  FormAnswer,
  ProfileField,
  SavedDetails,
} from '~/lib/form-model';
import type { FormRelation } from '~/lib/form-rules';
import type { DetailsChange } from '~/lib/member-details';
import { nimFinderSearch } from '~/lib/nim-finder';
import { ListFormResponsesQuerySchema } from '~/types/form.types';

type Form = typeof forms.$inferSelect;
type FormInsert = typeof forms.$inferInsert;

/** Published forms not switched off: drafts are never listed to members. */
export async function getActiveForms(db: Database) {
  return await db.query.forms.findMany({
    where: and(eq(forms.isActive, true), isNotNull(forms.publishedAt)),
    orderBy: [asc(forms.order), desc(forms.publishedAt)],
  });
}

export async function getFormById(db: Database, formId: string) {
  return await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
}

export async function getFormBySlug(db: Database, slug: string) {
  return await db.query.forms.findFirst({ where: eq(forms.slug, slug) });
}

/** Whether a form other than `exceptFormId` holds this short name. */
export async function slugTaken(
  db: Database,
  slug: string,
  exceptFormId: string | null,
) {
  const rows = await db
    .select({ id: forms.id })
    .from(forms)
    .where(
      exceptFormId
        ? and(eq(forms.slug, slug), ne(forms.id, exceptFormId))
        : eq(forms.slug, slug),
    )
    .limit(1);
  return rows.length > 0;
}

/** The form's owner's name, for the agreement sentence. */
export async function getOwnerName(
  db: Database,
  ownerId: string,
): Promise<{ fullName: string } | null> {
  const [row] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, ownerId));
  return row ?? null;
}

export async function getResponseByUserId(
  db: Database,
  formId: string,
  userId: string,
) {
  return await db.query.formResponses.findFirst({
    where: and(
      eq(formResponses.formId, formId),
      eq(formResponses.userId, userId),
    ),
  });
}

export async function createFormResponse(
  db: Database,
  formId: string,
  userId: string,
  data: {
    answers: FormAnswer[];
    profile?: Partial<Record<ProfileField, string>>;
  },
) {
  return await db
    .insert(formResponses)
    .values({
      formId,
      userId,
      answers: data.answers,
      profile: data.profile ?? {},
    })
    .returning()
    .then(firstSure);
}

/** "Ubah jawaban": the member's one response, replaced, with when. */
export async function updateFormResponse(
  db: Database,
  responseId: string,
  data: {
    answers: FormAnswer[];
    profile: Partial<Record<ProfileField, string>>;
  },
) {
  return await db
    .update(formResponses)
    .set({
      answers: data.answers,
      profile: data.profile,
      updatedAt: new Date(),
    })
    .where(eq(formResponses.id, responseId))
    .returning()
    .then(firstSure);
}

export async function getFormResponsesList(
  db: Database,
  formId: string,
  q: z.infer<typeof ListFormResponsesQuerySchema>,
) {
  const searchQ = q.search
    ? or(
        ilike(users.nim, `%${q.search}%`),
        ilike(users.fullName, `%${q.search}%`),
      )
    : undefined;

  const where = and(eq(formResponses.formId, formId), searchQ);

  const [responses, [{ count }]] = await Promise.all([
    db
      .select({
        id: formResponses.id,
        userId: formResponses.userId,
        answers: formResponses.answers,
        submittedAt: formResponses.submittedAt,
        nim: users.nim,
        fullName: users.fullName,
        major: users.major,
        angkatan: users.angkatan,
      })
      .from(formResponses)
      .innerJoin(users, eq(formResponses.userId, users.id))
      .where(where)
      .orderBy(desc(formResponses.submittedAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(formResponses)
      .innerJoin(users, eq(formResponses.userId, users.id))
      .where(where),
  ]);

  return { responses, total: count };
}

export async function getFormResponsesCount(db: Database, formId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(formResponses)
    .where(eq(formResponses.formId, formId));
  return count;
}

/** Responses per form, for a list. */
export async function getResponseCounts(db: Database, formIds: string[]) {
  if (formIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({
      formId: formResponses.formId,
      count: sql<number>`count(*)::int`,
    })
    .from(formResponses)
    .where(inArray(formResponses.formId, formIds))
    .groupBy(formResponses.formId);
  return new Map(rows.map((r) => [r.formId, r.count]));
}

export async function getFormResponsesForAnalytics(
  db: Database,
  formId: string,
) {
  return await db
    .select({ answers: formResponses.answers })
    .from(formResponses)
    .where(eq(formResponses.formId, formId));
}

/** Every response with what the Jawaban tab and the export read. Never who sent it beyond the requested fields. */
export async function getResponsesForSummary(db: Database, formId: string) {
  return await db
    .select({
      answers: formResponses.answers,
      profile: formResponses.profile,
      submittedAt: formResponses.submittedAt,
      updatedAt: formResponses.updatedAt,
    })
    .from(formResponses)
    .where(eq(formResponses.formId, formId))
    .orderBy(asc(formResponses.submittedAt), asc(formResponses.id));
}

/** The responses one by one, oldest first, each with its number in that order. */
export async function getResponsesPage(
  db: Database,
  formId: string,
  page: number,
  limit: number,
) {
  const [rows, total] = await Promise.all([
    db
      .select({
        id: formResponses.id,
        number: sql<number>`(row_number() over (order by ${formResponses.submittedAt}, ${formResponses.id}))::int`,
        submittedAt: formResponses.submittedAt,
        updatedAt: formResponses.updatedAt,
        profile: formResponses.profile,
        answers: formResponses.answers,
      })
      .from(formResponses)
      .where(eq(formResponses.formId, formId))
      .orderBy(asc(formResponses.submittedAt), asc(formResponses.id))
      .limit(limit)
      .offset((page - 1) * limit),
    getFormResponsesCount(db, formId),
  ]);
  return { responses: rows, total };
}

/** Members in these angkatan. */
export async function countAudience(db: Database, angkatan: number[]) {
  if (angkatan.length === 0) return 0;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(inArray(users.angkatan, angkatan));
  return count;
}

export function buildAnalytics(
  sections: FormSection[],
  responses: Array<{
    answers: Array<{ questionId: string; answer: string | string[] }>;
  }>,
) {
  const choiceQuestions = sections.flatMap((s) =>
    s.questions.filter(
      (q) => q.type === 'radio' || q.type === 'checkbox' || q.type === 'rating',
    ),
  );

  const questions = choiceQuestions.map((question) => {
    const counts = new Map<string, number>();
    for (const option of question.options ?? []) {
      counts.set(option, 0);
    }

    for (const response of responses) {
      const answer = response.answers.find(
        (a) => a.questionId === question.id,
      )?.answer;
      if (!answer) continue;

      const values = Array.isArray(answer) ? answer : [answer];
      for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }

    return {
      questionId: question.id,
      label: question.label,
      type: question.type as 'radio' | 'checkbox' | 'rating',
      options: Array.from(counts.entries()).map(([value, count]) => ({
        value,
        count,
      })),
    };
  });

  return { totalResponses: responses.length, questions };
}

// The builder.

const personColumns = {
  id: users.id,
  fullName: users.fullName,
  nim: users.nim,
  picture: users.picture,
};

export interface FormPerson {
  id: string;
  fullName: string;
  nim: string;
  picture: string | null;
}

export async function getPerson(
  db: Database,
  userId: string,
): Promise<FormPerson | null> {
  const [row] = await db
    .select(personColumns)
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
}

/** A member's relation to a form: its owner, the role it is shared with them as, or null. */
export async function getFormRelation(
  db: Database,
  form: Pick<Form, 'id' | 'ownerId'>,
  userId: string,
): Promise<FormRelation> {
  if (form.ownerId === userId) return 'owner';
  const [row] = await db
    .select({ role: formCollaborators.role })
    .from(formCollaborators)
    .where(
      and(
        eq(formCollaborators.formId, form.id),
        eq(formCollaborators.userId, userId),
      ),
    );
  return row?.role ?? null;
}

/**
 * Forms for Kelola › Form: those `userId` made or that are shared with them, or every form (`all`), each with its
 * owner, the member's relation, and how many questions and responses it has.
 */
export async function listManagedForms(
  db: Database,
  userId: string,
  scope: 'mine' | 'all',
) {
  const sharedWithMe = db
    .select({ one: sql`1` })
    .from(formCollaborators)
    .where(
      and(
        eq(formCollaborators.formId, forms.id),
        eq(formCollaborators.userId, userId),
      ),
    );
  const rows = await db
    .select({
      form: forms,
      role: formCollaborators.role,
      owner: personColumns,
    })
    .from(forms)
    .leftJoin(
      formCollaborators,
      and(
        eq(formCollaborators.formId, forms.id),
        eq(formCollaborators.userId, userId),
      ),
    )
    .leftJoin(users, eq(users.id, forms.ownerId))
    .where(
      scope === 'all'
        ? undefined
        : or(eq(forms.ownerId, userId), exists(sharedWithMe)),
    )
    .orderBy(desc(forms.updatedAt));
  const counts = await getResponseCounts(
    db,
    rows.map((r) => r.form.id),
  );
  return rows.map((r) => ({
    form: r.form,
    owner: r.owner?.id ? (r.owner as FormPerson) : null,
    relation: (r.form.ownerId === userId
      ? 'owner'
      : (r.role ?? null)) as FormRelation,
    responseCount: counts.get(r.form.id) ?? 0,
  }));
}

export async function createForm(db: Database, values: FormInsert) {
  return await db.insert(forms).values(values).returning().then(firstSure);
}

export async function updateForm(
  db: Database,
  formId: string,
  patch: Partial<FormInsert>,
) {
  return await db
    .update(forms)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(forms.id, formId))
    .returning()
    .then(firstSure);
}

/**
 * Saves a form whose edit takes answers away, and strips those answers from every response, in one transaction:
 * the maker agreed they go for good.
 */
export async function updateFormDroppingAnswers(
  db: Database,
  formId: string,
  patch: Partial<FormInsert>,
  lostQuestionIds: string[],
) {
  return await db.transaction(async (tx) => {
    const form = await tx
      .update(forms)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(forms.id, formId))
      .returning()
      .then(firstSure);
    const gone = new Set(lostQuestionIds);
    const responses = await tx
      .select({ id: formResponses.id, answers: formResponses.answers })
      .from(formResponses)
      .where(eq(formResponses.formId, formId))
      .for('update');
    for (const r of responses) {
      const kept = r.answers.filter((a) => !gone.has(a.questionId));
      if (kept.length !== r.answers.length)
        await tx
          .update(formResponses)
          .set({ answers: kept })
          .where(eq(formResponses.id, r.id));
    }
    return form;
  });
}

export async function deleteForm(db: Database, formId: string) {
  await db.delete(forms).where(eq(forms.id, formId));
}

export async function listCollaborators(db: Database, formId: string) {
  const rows = await db
    .select({ person: personColumns, role: formCollaborators.role })
    .from(formCollaborators)
    .innerJoin(users, eq(users.id, formCollaborators.userId))
    .where(eq(formCollaborators.formId, formId))
    .orderBy(asc(formCollaborators.createdAt), asc(users.fullName));
  return rows;
}

export async function setCollaborator(
  db: Database,
  formId: string,
  userId: string,
  role: CollaboratorRole,
) {
  await db
    .insert(formCollaborators)
    .values({ formId, userId, role })
    .onConflictDoUpdate({
      target: [formCollaborators.formId, formCollaborators.userId],
      set: { role },
    });
}

export async function removeCollaborator(
  db: Database,
  formId: string,
  userId: string,
) {
  const rows = await db
    .delete(formCollaborators)
    .where(
      and(
        eq(formCollaborators.formId, formId),
        eq(formCollaborators.userId, userId),
      ),
    )
    .returning({ userId: formCollaborators.userId });
  return rows.length > 0;
}

/** Whether a member holds any role (is pengurus). */
export async function isPengurus(db: Database, userId: string) {
  const rows = await db
    .select({ one: sql`1` })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .limit(1);
  return rows.length > 0;
}

/** Bagikan's search: members by name or NIM, as NIM Finder orders them, with whether each is pengurus. At most 20. */
export async function searchPeople(db: Database, search: string) {
  const { where, orderBy } = nimFinderSearch(search);
  return await db
    .select({
      ...personColumns,
      isPengurus: sql<boolean>`exists (select 1 from ${userRoles} where ${userRoles.userId} = ${users.id})`,
    })
    .from(users)
    .where(where)
    .orderBy(...orderBy)
    .limit(20);
}

// Saved details (Profil › Data diri).

export async function getMemberDetails(
  db: Database,
  userId: string,
): Promise<SavedDetails> {
  const row = await db.query.memberDetails.findFirst({
    where: eq(memberDetails.userId, userId),
  });
  return {
    whatsapp: row?.whatsapp ?? null,
    line: row?.line ?? null,
    instagram: row?.instagram ?? null,
    address: row?.address ?? null,
    hometown: row?.hometown ?? null,
    emergencyContact:
      row?.emergencyName && row.emergencyRelation && row.emergencyPhone
        ? {
            name: row.emergencyName,
            relation: row.emergencyRelation,
            phone: row.emergencyPhone,
          }
        : null,
    health: row?.health ?? null,
    birthDate: row?.birthDate ?? null,
    studentCardPhoto: row?.studentCardPhoto ?? null,
    photo: row?.photo ?? null,
  };
}

/** Applies a checked change (`lib/member-details.ts`): values set, nulls cleared, missing keys left. */
export async function saveMemberDetails(
  db: Database,
  userId: string,
  change: DetailsChange,
) {
  const set: Partial<typeof memberDetails.$inferInsert> = {};
  for (const [k, v] of Object.entries(change)) {
    if (v === undefined) continue;
    if (k === 'emergencyContact') {
      const c = v as SavedDetails['emergencyContact'];
      set.emergencyName = c?.name ?? null;
      set.emergencyRelation = c?.relation ?? null;
      set.emergencyPhone = c?.phone ?? null;
    } else (set as Record<string, unknown>)[k] = v;
  }
  await db
    .insert(memberDetails)
    .values({ userId, ...set })
    .onConflictDoUpdate({
      target: memberDetails.userId,
      set: { ...set, updatedAt: new Date() },
    });
}
