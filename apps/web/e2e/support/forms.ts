/**
 * The pretend API's forms (`db.formStore`), answered as `apps/api/src/controllers/form.controller.ts` and
 * `form-manage.controller.ts` answer them, with the API's own rules (`apps/api/src/lib/form-*.ts`,
 * `member-details.ts`). Read routes are defaults in handlers.ts; every write is in writes.ts and opt-in.
 */
import type {
  FormDetail,
  FormListItem,
  FormPerson,
  ManageForm,
  ManageFormListItem,
} from '../../src/api/generated';
import {
  findInvalidAnswer,
  findMissingRequiredQuestions,
  keepVisibleAnswers,
} from '../../../api/src/lib/form-answers';
import {
  storedFileCheck,
  type FormAnswer,
  type StoredFileCheck,
} from '../../../api/src/lib/form-model';
import {
  formAccess,
  manageStatus,
  type FormRelation,
} from '../../../api/src/lib/form-rules';
import {
  detailsProblems,
  missingFields,
  profileSnapshot,
  tidyChange,
  type AccountFacts,
  type DetailsChange,
} from '../../../api/src/lib/member-details';
import {
  NOW,
  formSectionsVisibleFor,
  formStatusFor,
  type Db,
  type StoredForm,
} from '../fixtures/api';
import { MEDIA_STORE, PENGURUS_PEOPLE, personId } from '../fixtures/forms';
import { reply } from './mock';

/** Members per angkatan in the sample (the prototype's "dari 132 anggota"). */
export const AUDIENCE: Record<number, number> = {
  2023: 118,
  2024: 171,
  2025: 132,
};
export const audienceOf = (angkatan: readonly number[]) =>
  angkatan.reduce((n, a) => n + (AUDIENCE[a] ?? 0), 0);

/** Today in WIB on the fixed clock, as the API reads it for a birth date. */
export const TODAY = new Date(Date.parse(NOW) + 7 * 3_600_000)
  .toISOString()
  .slice(0, 10);

/**
 * In the app's storage, as the API checks it: the harness's VITE_MEDIA_URL. A file the test uploaded through the mock
 * (`writes.presign`, served as an image under `/__e2e__/media/`) counts too, whatever its type.
 */
export const isStoredFile: StoredFileCheck = (url, types) =>
  url.startsWith('/__e2e__/media/') ||
  storedFileCheck((u) => u.startsWith(`${MEDIA_STORE}/`))(url, types);

export const unauthorized = () => reply.status(401, { error: 'Unauthorized' });
export const notFound = () => reply.status(404, { error: 'Form not found' });
export const viewOnly = () =>
  reply.status(403, { error: 'You may only see this form' });

export const isAdmin = (db: Db) => (db.me?.roles ?? []).includes('admin');
export const isPengurus = (db: Db) => (db.me?.roles.length ?? 0) > 0;

export function personOf(db: Db, userId: string): FormPerson | null {
  const m = db.members.find((x) => x.id === userId);
  return m
    ? { id: m.id, fullName: m.fullName, nim: m.nim, picture: m.picture ?? null }
    : null;
}

export const pengurusIds = () => PENGURUS_PEOPLE.map(personId);

export function relationOf(db: Db, form: StoredForm): FormRelation {
  if (form.ownerId === db.me?.id) return 'owner';
  return form.shared.find((s) => s.userId === db.me?.id)?.role ?? null;
}

export const accessOf = (db: Db, form: StoredForm) =>
  formAccess(relationOf(db, form), isAdmin(db));

export const findForm = (db: Db, id: string) =>
  db.formStore.find((f) => f.id === id);

/** The form and this member's access, or a reply: 404 when it isn't there or they may not see it. */
export function loadForManage(db: Db, id: string) {
  const form = findForm(db, id);
  if (!form) return null;
  const access = accessOf(db, form);
  return access.canView ? { form, access } : null;
}

export function manageView(db: Db, form: StoredForm): ManageForm {
  return {
    id: form.id,
    slug: form.slug,
    slugCustom: form.slugCustom,
    title: form.title,
    description: form.description,
    sections: form.sections,
    requestedFields: form.requestedFields,
    eligibleAngkatan: form.eligibleAngkatan,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    isActive: form.isActive,
    allowEdit: form.allowEdit,
    thanks: form.thanks,
    status: manageStatus(form, Date.parse(NOW)),
    publishedAt: form.publishedAt,
    owner: form.ownerId ? personOf(db, form.ownerId) : null,
    access: accessOf(db, form),
    responseCount: form.responses.length,
    audience: audienceOf(form.eligibleAngkatan),
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
  };
}

export function manageListItem(db: Db, form: StoredForm): ManageFormListItem {
  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    status: manageStatus(form, Date.parse(NOW)),
    eligibleAngkatan: form.eligibleAngkatan,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    questionCount: form.sections.flatMap((s) => s.questions).length,
    responseCount: form.responses.length,
    owner: form.ownerId ? personOf(db, form.ownerId) : null,
    access: accessOf(db, form),
    updatedAt: form.updatedAt,
  };
}

/** Bagikan's Akses pengurus: the owner, then each person with their role. */
export function accessList(db: Db, form: StoredForm) {
  return {
    owner: form.ownerId ? personOf(db, form.ownerId) : null,
    people: form.shared.map((s) => ({
      person: personOf(db, s.userId)!,
      role: s.role,
    })),
  };
}

export const myResponse = (db: Db, form: StoredForm) =>
  form.responses.find((r) => r.userId === db.me?.id);

const published = (form: StoredForm) =>
  form.publishedAt !== null
    ? { ...form, opensAt: form.opensAt ?? form.publishedAt }
    : null;

/** A published form as `GET /form` lists it for this member. */
export function memberListItem(db: Db, form: StoredForm): FormListItem | null {
  const f = published(form);
  if (!f || !f.isActive || !f.eligibleAngkatan.includes(db.me!.angkatan))
    return null;
  return {
    id: f.id,
    slug: f.slug,
    title: f.title,
    description: f.description,
    eligibleAngkatan: f.eligibleAngkatan,
    opensAt: f.opensAt!,
    closesAt: f.closesAt,
    isActive: f.isActive,
    order: f.order,
    createdAt: f.createdAt,
    requestedFields: f.requestedFields,
    allowEdit: f.allowEdit,
    status: formStatusFor(
      { opensAt: f.opensAt!, closesAt: f.closesAt, isActive: f.isActive },
      { responded: !!myResponse(db, f), nim: db.me!.nim },
    ),
    sectionCount: f.sections.length,
  };
}

/** `GET /form/{id}` for a builder's form: a draft is never found; questions only for its angkatan or admin. */
export function memberDetail(db: Db, form: StoredForm): FormDetail | null {
  const f = published(form);
  if (!f) return null;
  const window = {
    opensAt: f.opensAt!,
    closesAt: f.closesAt,
    isActive: f.isActive,
  };
  const responded = !!myResponse(db, f);
  const forMe = f.eligibleAngkatan.includes(db.me!.angkatan) || isAdmin(db);
  const open =
    formStatusFor(window, { responded: false, nim: db.me!.nim }) === 'open';
  const owner = f.ownerId ? personOf(db, f.ownerId) : null;
  return {
    id: f.id,
    slug: f.slug,
    title: f.title,
    description: f.description,
    eligibleAngkatan: f.eligibleAngkatan,
    opensAt: f.opensAt!,
    closesAt: f.closesAt,
    isActive: f.isActive,
    order: f.order,
    createdAt: f.createdAt,
    requestedFields: f.requestedFields,
    allowEdit: f.allowEdit,
    sections:
      forMe && formSectionsVisibleFor(window, db.me!.nim) ? f.sections : null,
    status: formStatusFor(window, { responded, nim: db.me!.nim }),
    thanks: f.thanks,
    owner: owner && { fullName: owner.fullName },
    canChange: responded && f.allowEdit && open,
  };
}

export function accountOf(db: Db): AccountFacts {
  const me = db.me!;
  return {
    fullName: me.fullName,
    nim: me.nim,
    major: me.major,
    angkatan: me.angkatan,
    region: me.region,
    email: me.email,
  };
}

export function myDetails(db: Db) {
  const account = accountOf(db);
  return {
    account: {
      fullName: account.fullName,
      nim: account.nim,
      major:
        account.major === 'IF'
          ? 'Teknik Informatika'
          : 'Sistem dan Teknologi Informasi',
      angkatan: String(account.angkatan),
      campus: account.region,
      email: account.email,
    },
    saved: db.memberDetails,
  };
}

/**
 * A response checked as the API checks it (`checkSubmission`): answers that fit, required ones given, and the
 * agreement plus every requested field. Returns the answers and profile to keep, or the API's 400.
 */
export function checkSubmission(
  db: Db,
  form: StoredForm,
  body: { answers: FormAnswer[]; details?: DetailsChange; agreed?: boolean },
) {
  const invalid = findInvalidAnswer(form.sections, body.answers, {
    maxText: 10_000,
    isStoredFile,
  });
  if (invalid) return { error: reply.status(400, { error: invalid }) };
  const answers = keepVisibleAnswers(form.sections, body.answers);
  const missing = findMissingRequiredQuestions(form.sections, answers);
  if (missing.length)
    return {
      error: reply.status(400, {
        error: `Missing required answers: ${missing.join(', ')}`,
      }),
    };
  if (form.requestedFields.length === 0)
    return { answers, profile: {}, change: null };
  if (body.agreed !== true)
    return {
      error: reply.status(400, {
        error: 'Agree to send the requested profile fields first',
      }),
    };
  const change = tidyChange(body.details ?? {});
  const problems = detailsProblems(change, { today: TODAY, isStoredFile });
  if (Object.keys(problems).length)
    return {
      error: reply.status(400, {
        error: 'A saved detail does not fit',
        problems,
      }),
    };
  const saved = { ...db.memberDetails, ...change };
  const still = missingFields(form.requestedFields, accountOf(db), saved);
  if (still.length)
    return {
      error: reply.status(400, {
        error: 'Requested fields missing',
        missing: still,
      }),
    };
  return {
    answers,
    profile: profileSnapshot(form.requestedFields, accountOf(db), saved),
    change: Object.keys(change).length ? change : null,
  };
}
