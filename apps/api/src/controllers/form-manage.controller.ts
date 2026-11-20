import postgres from 'postgres';
import { rolesEnums } from '~/db/roles-group';
import { createId, type Form } from '~/db/schema';
import { NEW_FORM_FIELDS, PROFILE_FIELDS, questionsOf } from '~/lib/form-model';
import {
  definitionProblem,
  findBreakingChanges,
  formAccess,
  manageStatus,
  numberedSlug,
  publishProblems,
  slugFromTitle,
  slugProblem,
  tidySlug,
  type FormAccess,
} from '~/lib/form-rules';
import { exportTable, summarize, toCsv } from '~/lib/form-summary';
import { toXlsx } from '~/lib/form-xlsx';
import { forRoles } from '~/middlewares/role.middleware';
import {
  countAudience,
  createForm,
  deleteForm,
  getFormById,
  getFormRelation,
  getFormResponsesCount,
  getPerson,
  getResponsesForSummary,
  getResponsesPage,
  isPengurus,
  listCollaborators,
  listManagedForms,
  removeCollaborator,
  searchPeople,
  setCollaborator,
  slugTaken,
  updateForm,
  updateFormDroppingAnswers,
} from '~/repositories/form.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  checkFormSlugRoute,
  createFormRoute,
  deleteFormRoute,
  exportFormAnswersRoute,
  getFormAccessRoute,
  getFormSummaryRoute,
  getManagedFormRoute,
  listFormAnswersRoute,
  listManagedFormsRoute,
  publishFormRoute,
  removeFormAccessRoute,
  renameFormSlugRoute,
  searchFormAccessRoute,
  setFormAccessRoute,
  updateFormRoute,
} from '~/routes/form.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** Building forms is for pengurus: anyone holding at least one role (owner's decision). */
export const PENGURUS = rolesEnums;

export interface FormManageDeps {
  getUserRoles: WithoutDb<typeof getUserRoles>;
  getFormById: WithoutDb<typeof getFormById>;
  getFormRelation: WithoutDb<typeof getFormRelation>;
  listManagedForms: WithoutDb<typeof listManagedForms>;
  createForm: WithoutDb<typeof createForm>;
  updateForm: WithoutDb<typeof updateForm>;
  updateFormDroppingAnswers: WithoutDb<typeof updateFormDroppingAnswers>;
  deleteForm: WithoutDb<typeof deleteForm>;
  slugTaken: WithoutDb<typeof slugTaken>;
  getPerson: WithoutDb<typeof getPerson>;
  getFormResponsesCount: WithoutDb<typeof getFormResponsesCount>;
  countAudience: WithoutDb<typeof countAudience>;
  listCollaborators: WithoutDb<typeof listCollaborators>;
  setCollaborator: WithoutDb<typeof setCollaborator>;
  removeCollaborator: WithoutDb<typeof removeCollaborator>;
  isPengurus: WithoutDb<typeof isPengurus>;
  searchPeople: WithoutDb<typeof searchPeople>;
  getResponsesForSummary: WithoutDb<typeof getResponsesForSummary>;
  getResponsesPage: WithoutDb<typeof getResponsesPage>;
}

const databaseDeps: FormManageDeps = {
  getUserRoles: withDb(getUserRoles),
  getFormById: withDb(getFormById),
  getFormRelation: withDb(getFormRelation),
  listManagedForms: withDb(listManagedForms),
  createForm: withDb(createForm),
  updateForm: withDb(updateForm),
  updateFormDroppingAnswers: withDb(updateFormDroppingAnswers),
  deleteForm: withDb(deleteForm),
  slugTaken: withDb(slugTaken),
  getPerson: withDb(getPerson),
  getFormResponsesCount: withDb(getFormResponsesCount),
  countAudience: withDb(countAudience),
  listCollaborators: withDb(listCollaborators),
  setCollaborator: withDb(setCollaborator),
  removeCollaborator: withDb(removeCollaborator),
  isPengurus: withDb(isPengurus),
  searchPeople: withDb(searchPeople),
  getResponsesForSummary: withDb(getResponsesForSummary),
  getResponsesPage: withDb(getResponsesPage),
};

const isUniqueViolation = (err: unknown) =>
  err instanceof postgres.PostgresError && err.code === '23505';

export function createFormManageRouter(deps: FormManageDeps = databaseDeps) {
  const router = createAuthRouter();
  const pengurus = <R extends Parameters<typeof forRoles>[0]>(route: R) =>
    forRoles(route, PENGURUS, deps.getUserRoles);

  /** The form and what this member may do with it; null when it doesn't exist or they may not even see it. */
  async function load(formId: string, userId: string) {
    const form = await deps.getFormById(formId);
    if (!form) return null;
    const isAdmin = (await deps.getUserRoles(userId)).includes('admin');
    const access = formAccess(
      await deps.getFormRelation(form, userId),
      isAdmin,
    );
    return access.canView ? { form, access } : null;
  }

  async function view(form: Form, access: FormAccess) {
    const [owner, responseCount, audience] = await Promise.all([
      form.ownerId ? deps.getPerson(form.ownerId) : null,
      deps.getFormResponsesCount(form.id),
      deps.countAudience(form.eligibleAngkatan),
    ]);
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
      status: manageStatus(form),
      publishedAt: form.publishedAt,
      owner,
      access,
      responseCount,
      audience,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    };
  }

  /** A free short name made from `title`; the name `formId` already holds counts as free. */
  async function slugForTitle(title: string, formId: string | null) {
    const base = slugFromTitle(title);
    for (let n = 1; ; n++) {
      const slug = numberedSlug(base, n);
      if (!(await deps.slugTaken(slug, formId))) return slug;
    }
  }

  async function accessList(form: Form) {
    const [owner, people] = await Promise.all([
      form.ownerId ? deps.getPerson(form.ownerId) : null,
      deps.listCollaborators(form.id),
    ]);
    return { owner, people };
  }

  router.openapi(pengurus(listManagedFormsRoute), async (c) => {
    const { scope } = c.req.valid('query');
    const user = c.var.user;
    const isAdmin = (await deps.getUserRoles(user.id)).includes('admin');
    if (scope === 'all' && !isAdmin)
      return c.json({ error: 'Every form is for admin only' }, 403);
    const rows = await deps.listManagedForms(user.id, scope);
    return c.json(
      {
        forms: rows.map(({ form, owner, relation, responseCount }) => ({
          id: form.id,
          slug: form.slug,
          title: form.title,
          status: manageStatus(form),
          eligibleAngkatan: form.eligibleAngkatan,
          opensAt: form.opensAt,
          closesAt: form.closesAt,
          questionCount: questionsOf(form.sections).length,
          responseCount,
          owner,
          access: formAccess(relation, isAdmin),
          updatedAt: form.updatedAt,
        })),
      },
      200,
    );
  });

  router.openapi(pengurus(createFormRoute), async (c) => {
    const user = c.var.user;
    const { title = '' } = c.req.valid('json');
    const form = await deps.createForm({
      ownerId: user.id,
      title: title.trim(),
      slug: await slugForTitle(title, null),
      sections: [
        {
          id: `s${createId()}`,
          title: '',
          questions: [
            {
              id: `q${createId()}`,
              label: '',
              type: 'radio',
              options: ['Opsi 1'],
            },
          ],
        },
      ],
      requestedFields: [...NEW_FORM_FIELDS],
      eligibleAngkatan: [],
      opensAt: null,
      isActive: false,
    });
    return c.json(await view(form, formAccess('owner', false)), 201);
  });

  router.openapi(pengurus(getManagedFormRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    return c.json(await view(found.form, found.access), 200);
  });

  router.openapi(pengurus(updateFormRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    if (!found.access.canEdit)
      return c.json({ error: 'You may only see this form' }, 403);
    const { form } = found;
    const body = c.req.valid('json');
    const { confirmBreaking, opensAt, closesAt, ...rest } = body;

    if (rest.sections) {
      const problem = definitionProblem(rest.sections);
      if (problem) return c.json({ error: problem }, 400);
    }
    const published = form.publishedAt !== null;
    if (published && rest.eligibleAngkatan?.length === 0)
      return c.json({ error: 'A published form needs an angkatan' }, 400);
    if (published && opensAt === null)
      return c.json({ error: 'A published form has an opening time' }, 400);
    const at = (v: string | null) => (v === null ? null : new Date(v));
    const nextOpens = opensAt === undefined ? form.opensAt : at(opensAt);
    const nextCloses = closesAt === undefined ? form.closesAt : at(closesAt);
    if (nextOpens && nextCloses && nextCloses <= nextOpens)
      return c.json({ error: 'Closes before it opens' }, 400);

    const fields = rest.requestedFields;
    const patch: Partial<typeof form> = {
      ...rest,
      ...(fields
        ? { requestedFields: PROFILE_FIELDS.filter((f) => fields.includes(f)) }
        : {}),
      ...(rest.eligibleAngkatan
        ? {
            eligibleAngkatan: [...new Set(rest.eligibleAngkatan)].sort(
              (a, b) => a - b,
            ),
          }
        : {}),
      ...(rest.title !== undefined ? { title: rest.title.trim() } : {}),
      ...(opensAt !== undefined ? { opensAt: nextOpens } : {}),
      ...(closesAt !== undefined ? { closesAt: nextCloses } : {}),
    };
    if (!published && !form.slugCustom && rest.title !== undefined)
      patch.slug = await slugForTitle(rest.title, form.id);

    const breaking = rest.sections
      ? findBreakingChanges(form.sections, rest.sections)
      : [];
    const responseCount =
      breaking.length > 0 ? await deps.getFormResponsesCount(form.id) : 0;
    if (responseCount > 0 && !confirmBreaking)
      return c.json(
        {
          error: 'This edit takes answers away',
          breaking,
          responseCount,
        },
        409,
      );
    const saved =
      responseCount > 0
        ? await deps.updateFormDroppingAnswers(
            form.id,
            patch,
            breaking.map((b) => b.questionId),
          )
        : await deps.updateForm(form.id, patch);
    return c.json(await view(saved, found.access), 200);
  });

  router.openapi(pengurus(publishFormRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    if (!found.access.canEdit)
      return c.json({ error: 'You may only see this form' }, 403);
    const { form } = found;
    if (form.publishedAt !== null)
      return c.json({ error: 'Already published' }, 409);
    const problems = publishProblems(form);
    if (problems.length > 0)
      return c.json({ error: 'Not ready to publish', problems }, 400);
    const now = new Date();
    const patch = {
      publishedAt: now,
      isActive: true,
      opensAt: form.opensAt ?? now,
      ...(form.slugCustom
        ? {}
        : { slug: await slugForTitle(form.title, form.id) }),
    };
    try {
      return c.json(
        await view(await deps.updateForm(form.id, patch), found.access),
        200,
      );
    } catch (err) {
      // Another form took the name between the check and the save.
      if (!isUniqueViolation(err)) throw err;
      return c.json(
        await view(
          await deps.updateForm(form.id, {
            ...patch,
            slug: await slugForTitle(form.title, form.id),
          }),
          found.access,
        ),
        200,
      );
    }
  });

  router.openapi(pengurus(deleteFormRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    if (!found.access.canEdit)
      return c.json({ error: 'You may only see this form' }, 403);
    await deps.deleteForm(formId);
    return c.body(null, 204);
  });

  router.openapi(pengurus(checkFormSlugRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    if (!found.access.canEdit)
      return c.json({ error: 'You may only see this form' }, 403);
    const slug = tidySlug(c.req.valid('query').slug);
    const problem =
      slugProblem(slug) ??
      ((await deps.slugTaken(slug, formId)) ? ('taken' as const) : null);
    return c.json({ slug, available: problem === null, problem }, 200);
  });

  router.openapi(pengurus(renameFormSlugRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    if (!found.access.canEdit)
      return c.json({ error: 'You may only see this form' }, 403);
    const slug = tidySlug(c.req.valid('json').slug);
    const problem = slugProblem(slug);
    if (problem) return c.json({ error: 'Not a short name', problem }, 400);
    if (await deps.slugTaken(slug, formId))
      return c.json(
        { error: 'Another form holds it', problem: 'taken' as const },
        409,
      );
    try {
      const saved = await deps.updateForm(formId, { slug, slugCustom: true });
      return c.json(await view(saved, found.access), 200);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      return c.json(
        { error: 'Another form holds it', problem: 'taken' as const },
        409,
      );
    }
  });

  router.openapi(pengurus(getFormAccessRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    return c.json(await accessList(found.form), 200);
  });

  router.openapi(pengurus(searchFormAccessRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    if (!found.access.canEdit)
      return c.json({ error: 'You may only see this form' }, 403);
    const { search } = c.req.valid('query');
    const [found2, list] = await Promise.all([
      deps.searchPeople(search),
      deps.listCollaborators(formId),
    ]);
    const roles = new Map(list.map((p) => [p.person.id, p.role]));
    return c.json(
      {
        people: found2.map(({ isPengurus, ...person }) => ({
          person,
          isPengurus,
          role:
            person.id === found.form.ownerId
              ? ('owner' as const)
              : (roles.get(person.id) ?? null),
        })),
      },
      200,
    );
  });

  router.openapi(pengurus(setFormAccessRoute), async (c) => {
    const { formId, userId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    if (!found.access.canEdit)
      return c.json({ error: 'You may only see this form' }, 403);
    if (userId === found.form.ownerId)
      return c.json({ error: "The owner's access never changes" }, 400);
    if (!(await deps.getPerson(userId)))
      return c.json({ error: 'No such member' }, 404);
    if (!(await deps.isPengurus(userId)))
      return c.json({ error: 'Only pengurus can be added' }, 400);
    await deps.setCollaborator(formId, userId, c.req.valid('json').role);
    return c.json(await accessList(found.form), 200);
  });

  router.openapi(pengurus(removeFormAccessRoute), async (c) => {
    const { formId, userId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    if (!found.access.canEdit)
      return c.json({ error: 'You may only see this form' }, 403);
    if (userId === found.form.ownerId)
      return c.json({ error: 'The owner can never be removed' }, 400);
    await deps.removeCollaborator(formId, userId);
    return c.json(await accessList(found.form), 200);
  });

  router.openapi(pengurus(getFormSummaryRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    const [responses, audience] = await Promise.all([
      deps.getResponsesForSummary(formId),
      deps.countAudience(found.form.eligibleAngkatan),
    ]);
    return c.json(
      { ...summarize(found.form.sections, responses), audience },
      200,
    );
  });

  router.openapi(pengurus(listFormAnswersRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    const { page, limit } = c.req.valid('query');
    const { responses, total } = await deps.getResponsesPage(
      formId,
      page,
      limit,
    );
    return c.json({ responses, total, page, limit }, 200);
  });

  router.openapi(pengurus(exportFormAnswersRoute), async (c) => {
    const { formId } = c.req.valid('param');
    const found = await load(formId, c.var.user.id);
    if (!found) return c.json({ error: 'Form not found' }, 404);
    const { format } = c.req.valid('query');
    const table = exportTable(
      found.form,
      await deps.getResponsesForSummary(formId),
    );
    const name = `${found.form.slug}-jawaban.${format}`;
    c.header('Content-Disposition', `attachment; filename="${name}"`);
    c.header('Cache-Control', 'no-store');
    if (format === 'csv') {
      c.header('Content-Type', 'text/csv; charset=utf-8');
      return c.body(toCsv(table), 200);
    }
    c.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    return c.body(new Uint8Array(await toXlsx(table)), 200);
  });

  return router;
}

export const formManageRouter = createFormManageRouter();
