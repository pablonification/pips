import postgres from 'postgres';
import { env } from '~/configs/env.config';
import type { Form } from '~/db/schema';
import { databaseError } from '~/lib/database-error';
import {
  findInvalidAnswer,
  findMissingRequiredQuestions,
  keepVisibleAnswers,
} from '~/lib/form-answers';
import type { FormAnswer } from '~/lib/form-model';
import {
  formQuestionsVisible,
  formStatus,
  sectionCount,
  wibToday,
} from '~/lib/form-status';
import { isFileStoreUrl } from '~/lib/media-url';
import {
  detailsProblems,
  EMPTY_DETAILS,
  fieldValue,
  missingFields,
  profileSnapshot,
  tidyChange,
  type AccountFacts,
  type DetailsChange,
} from '~/lib/member-details';
import { MAX_FORM_TEXT_ANSWER } from '~/lib/limits';
import { forRoles } from '~/middlewares/role.middleware';
import {
  buildAnalytics,
  createFormResponse,
  getActiveForms,
  getFormById,
  getFormBySlug,
  getFormRelation,
  getFormResponsesCount,
  getFormResponsesForAnalytics,
  getFormResponsesList,
  getMemberDetails,
  getOwnerName,
  getResponseByUserId,
  saveMemberDetails,
  updateFormResponse,
} from '~/repositories/form.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  changeFormResponseRoute,
  getFormAnalyticsRoute,
  getFormResponsesCountRoute,
  getFormRoute,
  getMyDetailsRoute,
  getMyFormResponseRoute,
  listAllFormsRoute,
  listFormResponsesRoute,
  listFormsRoute,
  openFormLinkRoute,
  submitFormResponseRoute,
  updateMyDetailsRoute,
} from '~/routes/form.route';
import type { SubmitFormResponseSchema } from '~/types/form.types';
import type { z } from 'zod';
import { formAdminRoom, getIo } from '~/websocket/setup';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

const FORM_ADMIN_ROLES = ['admin'] as const;

/** What the form routes need from storage and the socket, passed in so the route tests run without a database. */
export interface FormDeps {
  getActiveForms: WithoutDb<typeof getActiveForms>;
  getFormById: WithoutDb<typeof getFormById>;
  getFormBySlug: WithoutDb<typeof getFormBySlug>;
  getFormRelation: WithoutDb<typeof getFormRelation>;
  getOwnerName: WithoutDb<typeof getOwnerName>;
  getResponseByUserId: WithoutDb<typeof getResponseByUserId>;
  createFormResponse: WithoutDb<typeof createFormResponse>;
  updateFormResponse: WithoutDb<typeof updateFormResponse>;
  getFormResponsesCount: WithoutDb<typeof getFormResponsesCount>;
  getFormResponsesList: WithoutDb<typeof getFormResponsesList>;
  getFormResponsesForAnalytics: WithoutDb<typeof getFormResponsesForAnalytics>;
  getMemberDetails: WithoutDb<typeof getMemberDetails>;
  saveMemberDetails: WithoutDb<typeof saveMemberDetails>;
  /** A member's roles, read only when needed (a form admin, a draft's manager). */
  getUserRoles: WithoutDb<typeof getUserRoles>;
  /** Whether an address is a file in the app's own storage. */
  isStoredFile: (url: string) => boolean;
  /** Tells Live Counting and the Jawaban tab (the form's watchers' room) about a new response. */
  announceResponse: (formId: string, event: object) => void;
}

const databaseDeps: FormDeps = {
  getActiveForms: withDb(getActiveForms),
  getFormById: withDb(getFormById),
  getFormBySlug: withDb(getFormBySlug),
  getFormRelation: withDb(getFormRelation),
  getOwnerName: withDb(getOwnerName),
  getResponseByUserId: withDb(getResponseByUserId),
  createFormResponse: withDb(createFormResponse),
  updateFormResponse: withDb(updateFormResponse),
  getFormResponsesCount: withDb(getFormResponsesCount),
  getFormResponsesList: withDb(getFormResponsesList),
  getFormResponsesForAnalytics: withDb(getFormResponsesForAnalytics),
  getMemberDetails: withDb(getMemberDetails),
  saveMemberDetails: withDb(saveMemberDetails),
  getUserRoles: withDb(getUserRoles),
  isStoredFile: (url) => isFileStoreUrl(url, env.R2_PUBLIC_URL),
  announceResponse: (formId, event) => {
    getIo().to(formAdminRoom(formId)).emit('form:new-response', event);
  },
};

/** What a list or a member's page says about any published form; never its owner's id or the builder's own fields. */
export function formBase(form: Form) {
  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    eligibleAngkatan: form.eligibleAngkatan,
    // Set on every published form; a draft never reaches these routes.
    opensAt: form.opensAt ?? form.publishedAt ?? form.createdAt,
    closesAt: form.closesAt,
    isActive: form.isActive,
    order: form.order,
    createdAt: form.createdAt,
    requestedFields: form.requestedFields,
    allowEdit: form.allowEdit,
  };
}

type Member = AccountFacts & { id: string };

/** A form members may reach: it exists and is not a draft. */
const isPublished = (form: Form | undefined): form is Form =>
  !!form?.publishedAt;
type Submission = z.infer<typeof SubmitFormResponseSchema>;
type Checked =
  | { ok: false; status: 400; body: object }
  | {
      ok: true;
      answers: FormAnswer[];
      profile: Partial<Record<string, string>>;
      saveDetails: DetailsChange | null;
    };

/**
 * A submission checked against its form: answers that fit, required ones given, and, when the form requests profile
 * fields, the member's agreement and every field known (from their profile or `details`). Nothing is saved here.
 */
async function checkSubmission(
  deps: FormDeps,
  form: Form,
  user: Member,
  data: Submission,
): Promise<Checked> {
  const invalid = findInvalidAnswer(form.sections, data.answers, {
    maxText: MAX_FORM_TEXT_ANSWER,
    isStoredFile: deps.isStoredFile,
  });
  if (invalid) return { ok: false, status: 400, body: { error: invalid } };
  const answers = keepVisibleAnswers(form.sections, data.answers);
  const missing = findMissingRequiredQuestions(form.sections, answers);
  if (missing.length > 0)
    return {
      ok: false,
      status: 400,
      body: { error: `Missing required answers: ${missing.join(', ')}` },
    };

  if (form.requestedFields.length === 0)
    return { ok: true, answers, profile: {}, saveDetails: null };

  if (data.agreed !== true)
    return {
      ok: false,
      status: 400,
      body: { error: 'Agree to send the requested profile fields first' },
    };
  const change = tidyChange(data.details ?? {});
  const problems = detailsProblems(change, {
    today: wibToday(),
    isStoredFile: deps.isStoredFile,
  });
  if (Object.keys(problems).length > 0)
    return {
      ok: false,
      status: 400,
      body: { error: 'A saved detail does not fit', problems },
    };
  const saved = { ...(await deps.getMemberDetails(user.id)), ...change };
  const stillMissing = missingFields(form.requestedFields, user, saved);
  if (stillMissing.length > 0)
    return {
      ok: false,
      status: 400,
      body: { error: 'Requested fields missing', missing: stillMissing },
    };
  return {
    ok: true,
    answers,
    profile: profileSnapshot(form.requestedFields, user, saved),
    saveDetails: Object.keys(change).length > 0 ? change : null,
  };
}

/**
 * What a new response tells the form's watchers. Live Counting's forms from before the builder list who sent it, as
 * they always did; a form made in the builder says only its name and NIM when it requests them.
 */
function responseEvent(form: Form, user: Member, total: number, at: Date) {
  if (form.ownerId === null)
    return { total, nim: user.nim, fullName: user.fullName, submittedAt: at };
  return {
    total,
    submittedAt: at,
    ...(form.requestedFields.includes('nim') ? { nim: user.nim } : {}),
    ...(form.requestedFields.includes('fullName')
      ? { fullName: user.fullName }
      : {}),
  };
}

function account(user: Member) {
  const fact = (f: Parameters<typeof fieldValue>[0]) =>
    fieldValue(f, user, EMPTY_DETAILS) ?? '';
  return {
    fullName: fact('fullName'),
    nim: fact('nim'),
    major: fact('major'),
    angkatan: fact('angkatan'),
    campus: fact('campus'),
    email: fact('email'),
  };
}

export function createFormRouter(deps: FormDeps = databaseDeps) {
  const formRouter = createAuthRouter();

  const isAdmin = async (userId: string) =>
    (await deps.getUserRoles(userId)).some((r) =>
      (FORM_ADMIN_ROLES as readonly string[]).includes(r),
    );

  /** May open a form in Kelola › Form: pengurus who own it, it is shared with, or admin. */
  const canManage = async (form: Form, userId: string) => {
    const roles = await deps.getUserRoles(userId);
    if (roles.length === 0) return false;
    if (roles.includes('admin')) return true;
    return (await deps.getFormRelation(form, userId)) !== null;
  };

  formRouter.openapi(listFormsRoute, async (c) => {
    const user = c.var.user;
    const activeForms = await deps.getActiveForms();
    const eligibleForms = activeForms.filter((f) =>
      f.eligibleAngkatan.includes(user.angkatan),
    );

    const forms = await Promise.all(
      eligibleForms.map(async (f) => {
        const response = await deps.getResponseByUserId(f.id, user.id);
        return {
          ...formBase(f),
          status: formStatus(f, { hasResponse: !!response, nim: user.nim }),
          sectionCount: sectionCount(f),
        };
      }),
    );

    return c.json({ forms }, 200);
  });

  formRouter.openapi(
    forRoles(listAllFormsRoute, FORM_ADMIN_ROLES, deps.getUserRoles),
    async (c) => {
      const activeForms = await deps.getActiveForms();
      return c.json({ forms: activeForms.map(formBase) }, 200);
    },
  );

  formRouter.openapi(getFormRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const user = c.var.user;
    const form = await deps.getFormById(formId);
    if (!isPublished(form)) return c.json({ error: 'Form not found' }, 404);

    const response = await deps.getResponseByUserId(formId, user.id);
    // Roles are read only for a member outside the form's angkatan, so eligible members pay no extra query.
    const isFormAdmin =
      !form.eligibleAngkatan.includes(user.angkatan) &&
      (await isAdmin(user.id));
    const open =
      formStatus(form, { hasResponse: false, nim: user.nim }) === 'open';

    return c.json(
      {
        ...formBase(form),
        sections: formQuestionsVisible(form, {
          nim: user.nim,
          angkatan: user.angkatan,
          isFormAdmin,
        })
          ? form.sections
          : null,
        status: formStatus(form, { hasResponse: !!response, nim: user.nim }),
        thanks: form.thanks,
        owner: form.ownerId ? await deps.getOwnerName(form.ownerId) : null,
        canChange: !!response && form.allowEdit && open,
      },
      200,
    );
  });

  formRouter.openapi(getMyFormResponseRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const form = await deps.getFormById(formId);
    if (!isPublished(form)) return c.json({ error: 'Form not found' }, 404);

    const response = await deps.getResponseByUserId(formId, c.var.user.id);
    return c.json(response ?? null, 200);
  });

  formRouter.openapi(submitFormResponseRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const user = c.var.user;
    const data = c.req.valid('json');

    const form = await deps.getFormById(formId);
    if (!isPublished(form)) return c.json({ error: 'Form not found' }, 404);

    if (!form.eligibleAngkatan.includes(user.angkatan)) {
      return c.json({ error: 'You are not eligible for this form' }, 403);
    }

    // Whether this member already answered is the database's to say (409 below).
    const status = formStatus(form, { hasResponse: false, nim: user.nim });
    if (status === 'closed') {
      return c.json({ error: 'This form is closed' }, 403);
    }
    if (status === 'not_opened') {
      return c.json({ error: 'This form has not opened yet' }, 403);
    }

    const checked = await checkSubmission(deps, form, user, data);
    if (!checked.ok) return c.json(checked.body as { error: string }, 400);

    try {
      if (checked.saveDetails)
        await deps.saveMemberDetails(user.id, checked.saveDetails);
      const response = await deps.createFormResponse(formId, user.id, {
        answers: checked.answers,
        profile: checked.profile,
      });

      deps.announceResponse(
        formId,
        responseEvent(
          form,
          user,
          await deps.getFormResponsesCount(formId),
          response.submittedAt,
        ),
      );

      return c.json(response, 201);
    } catch (err) {
      if (err instanceof postgres.PostgresError) {
        if (err.code === '23505') {
          return c.json(
            { error: 'Already submitted a response for this form' },
            409,
          );
        }
        return c.json(databaseError(err), 400);
      }
      throw err;
    }
  });

  formRouter.openapi(changeFormResponseRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const user = c.var.user;
    const data = c.req.valid('json');

    const form = await deps.getFormById(formId);
    if (!isPublished(form)) return c.json({ error: 'Form not found' }, 404);
    const response = await deps.getResponseByUserId(formId, user.id);
    if (!response) return c.json({ error: 'No response to change' }, 404);
    if (!form.allowEdit)
      return c.json({ error: 'This form does not allow changes' }, 403);
    if (
      !form.eligibleAngkatan.includes(user.angkatan) ||
      formStatus(form, { hasResponse: false, nim: user.nim }) !== 'open'
    )
      return c.json({ error: 'This form is closed' }, 403);

    const checked = await checkSubmission(deps, form, user, data);
    if (!checked.ok) return c.json(checked.body as { error: string }, 400);
    if (checked.saveDetails)
      await deps.saveMemberDetails(user.id, checked.saveDetails);
    const changed = await deps.updateFormResponse(response.id, {
      answers: checked.answers,
      profile: checked.profile,
    });
    return c.json(changed, 200);
  });

  formRouter.openapi(openFormLinkRoute, async (c) => {
    const { name } = c.req.valid('param');
    const user = c.var.user;
    const form = await deps.getFormBySlug(name.toLowerCase());
    if (!form) return c.json({ error: 'Form not found' }, 404);
    const manage = await canManage(form, user.id);
    const base = {
      formId: form.id,
      title: form.title,
      eligibleAngkatan: form.eligibleAngkatan,
      canManage: manage,
    };
    if (form.publishedAt === null)
      return manage
        ? c.json({ state: 'draft' as const, ...base }, 200)
        : c.json({ error: 'Form not found' }, 404);
    return c.json(
      {
        state: form.eligibleAngkatan.includes(user.angkatan)
          ? ('form' as const)
          : ('not_for_you' as const),
        ...base,
      },
      200,
    );
  });

  formRouter.openapi(getMyDetailsRoute, async (c) => {
    const user = c.var.user;
    return c.json(
      { account: account(user), saved: await deps.getMemberDetails(user.id) },
      200,
    );
  });

  formRouter.openapi(updateMyDetailsRoute, async (c) => {
    const user = c.var.user;
    const change = tidyChange(c.req.valid('json'));
    const problems = detailsProblems(change, {
      today: wibToday(),
      isStoredFile: deps.isStoredFile,
    });
    if (Object.keys(problems).length > 0)
      return c.json({ error: 'A saved detail does not fit', problems }, 400);
    if (Object.keys(change).length > 0)
      await deps.saveMemberDetails(user.id, change);
    return c.json(
      { account: account(user), saved: await deps.getMemberDetails(user.id) },
      200,
    );
  });

  formRouter.openapi(
    forRoles(listFormResponsesRoute, FORM_ADMIN_ROLES, deps.getUserRoles),
    async (c) => {
      const { formId } = c.req.valid('param');
      const query = c.req.valid('query');
      const { responses, total } = await deps.getFormResponsesList(
        formId,
        query,
      );
      return c.json(
        { responses, total, page: query.page, limit: query.limit },
        200,
      );
    },
  );

  formRouter.openapi(
    forRoles(getFormResponsesCountRoute, FORM_ADMIN_ROLES, deps.getUserRoles),
    async (c) => {
      const { formId } = c.req.valid('param');
      const total = await deps.getFormResponsesCount(formId);
      return c.json({ total }, 200);
    },
  );

  formRouter.openapi(
    forRoles(getFormAnalyticsRoute, FORM_ADMIN_ROLES, deps.getUserRoles),
    async (c) => {
      const { formId } = c.req.valid('param');
      const form = await deps.getFormById(formId);
      if (!form) return c.json({ error: 'Form not found' }, 404);

      const responses = await deps.getFormResponsesForAnalytics(formId);
      const analytics = buildAnalytics(form.sections, responses);
      return c.json(analytics, 200);
    },
  );

  return formRouter;
}

export const formRouter = createFormRouter();
