import postgres from 'postgres';
import { FormQuestion, FormSection } from '~/db/schema';
import {
  formSectionsVisible,
  formStatus,
  sectionCount,
} from '~/lib/form-status';
import { roleMiddleware } from '~/middlewares/role.middleware';
import {
  buildAnalytics,
  createFormResponse,
  getActiveForms,
  getFormById,
  getFormResponsesCount,
  getFormResponsesForAnalytics,
  getFormResponsesList,
  getResponseByUserId,
} from '~/repositories/form.repo';
import {
  getFormAnalyticsRoute,
  getFormResponsesCountRoute,
  getFormRoute,
  getMyFormResponseRoute,
  listAllFormsRoute,
  listFormResponsesRoute,
  listFormsRoute,
  submitFormResponseRoute,
} from '~/routes/form.route';
import { formAdminRoom, getIo } from '~/websocket/setup';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

const FORM_ADMIN_ROLES = ['admin'] as const;

/** What the form routes need from storage and the socket, passed in so the route tests run without a database. */
export interface FormDeps {
  getActiveForms: WithoutDb<typeof getActiveForms>;
  getFormById: WithoutDb<typeof getFormById>;
  getResponseByUserId: WithoutDb<typeof getResponseByUserId>;
  createFormResponse: WithoutDb<typeof createFormResponse>;
  getFormResponsesCount: WithoutDb<typeof getFormResponsesCount>;
  getFormResponsesList: WithoutDb<typeof getFormResponsesList>;
  getFormResponsesForAnalytics: WithoutDb<typeof getFormResponsesForAnalytics>;
  /** Tells Live Counting (the form's admin room) about a new response. */
  announceResponse: (formId: string, event: object) => void;
}

const databaseDeps: FormDeps = {
  getActiveForms: withDb(getActiveForms),
  getFormById: withDb(getFormById),
  getResponseByUserId: withDb(getResponseByUserId),
  createFormResponse: withDb(createFormResponse),
  getFormResponsesCount: withDb(getFormResponsesCount),
  getFormResponsesList: withDb(getFormResponsesList),
  getFormResponsesForAnalytics: withDb(getFormResponsesForAnalytics),
  announceResponse: (formId, event) => {
    getIo().to(formAdminRoom(formId)).emit('form:new-response', event);
  },
};

export function createFormRouter(deps: FormDeps = databaseDeps) {
  const formRouter = createAuthRouter();

  formRouter.openapi(listFormsRoute, async (c) => {
    const user = c.var.user;
    const activeForms = await deps.getActiveForms();
    const eligibleForms = activeForms.filter((f) =>
      f.eligibleAngkatan.includes(user.angkatan),
    );

    const forms = await Promise.all(
      eligibleForms.map(async (f) => {
        const response = await deps.getResponseByUserId(f.id, user.id);
        const { sections, ...rest } = f;
        return {
          ...rest,
          status: formStatus(f, { hasResponse: !!response, nim: user.nim }),
          sectionCount: sectionCount({ sections }),
        };
      }),
    );

    return c.json({ forms }, 200);
  });

  formRouter.get(
    listAllFormsRoute.getRoutingPath(),
    roleMiddleware([...FORM_ADMIN_ROLES]),
  );
  formRouter.openapi(listAllFormsRoute, async (c) => {
    const activeForms = await deps.getActiveForms();
    const forms = activeForms.map(({ sections: _sections, ...rest }) => rest);
    return c.json({ forms }, 200);
  });

  formRouter.openapi(getFormRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const user = c.var.user;
    const form = await deps.getFormById(formId);
    if (!form) return c.json({ error: 'Form not found' }, 404);

    const response = await deps.getResponseByUserId(formId, user.id);

    return c.json(
      {
        ...form,
        sections: formSectionsVisible(form, user.nim) ? form.sections : null,
        status: formStatus(form, { hasResponse: !!response, nim: user.nim }),
      },
      200,
    );
  });

  formRouter.openapi(getMyFormResponseRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const form = await deps.getFormById(formId);
    if (!form) return c.json({ error: 'Form not found' }, 404);

    const response = await deps.getResponseByUserId(formId, c.var.user.id);
    return c.json(response ?? null, 200);
  });

  formRouter.openapi(submitFormResponseRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const user = c.var.user;
    const data = c.req.valid('json');

    const form = await deps.getFormById(formId);
    if (!form) return c.json({ error: 'Form not found' }, 404);

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

    const missing = findMissingRequiredQuestions(form.sections, data.answers);
    if (missing.length > 0) {
      return c.json(
        { error: `Missing required answers: ${missing.join(', ')}` },
        400,
      );
    }

    try {
      const response = await deps.createFormResponse(formId, user.id, data);

      deps.announceResponse(formId, {
        total: await deps.getFormResponsesCount(formId),
        nim: user.nim,
        fullName: user.fullName,
        submittedAt: response.submittedAt,
      });

      return c.json(response, 201);
    } catch (err) {
      if (err instanceof postgres.PostgresError) {
        if (err.code === '23505') {
          return c.json(
            { error: 'Already submitted a response for this form' },
            409,
          );
        }
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  });

  formRouter.get(
    listFormResponsesRoute.getRoutingPath(),
    roleMiddleware([...FORM_ADMIN_ROLES]),
  );
  formRouter.openapi(listFormResponsesRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const query = c.req.valid('query');
    const { responses, total } = await deps.getFormResponsesList(formId, query);
    return c.json(
      { responses, total, page: query.page, limit: query.limit },
      200,
    );
  });

  formRouter.get(
    getFormResponsesCountRoute.getRoutingPath(),
    roleMiddleware([...FORM_ADMIN_ROLES]),
  );
  formRouter.openapi(getFormResponsesCountRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const total = await deps.getFormResponsesCount(formId);
    return c.json({ total }, 200);
  });

  formRouter.get(
    getFormAnalyticsRoute.getRoutingPath(),
    roleMiddleware([...FORM_ADMIN_ROLES]),
  );
  formRouter.openapi(getFormAnalyticsRoute, async (c) => {
    const { formId } = c.req.valid('param');
    const form = await deps.getFormById(formId);
    if (!form) return c.json({ error: 'Form not found' }, 404);

    const responses = await deps.getFormResponsesForAnalytics(formId);
    const analytics = buildAnalytics(form.sections, responses);
    return c.json(analytics, 200);
  });

  return formRouter;
}

export const formRouter = createFormRouter();

/**
 * Returns labels of required questions that were not answered. A question is
 * only required if it doesn't have a `dependsOn`, or its `dependsOn`
 * condition is satisfied by the submitted answers (see plan's judgment call
 * on question #17 — conditionally-required questions aren't required when
 * N/A).
 */
function findMissingRequiredQuestions(
  sections: FormSection[],
  answers: Array<{ questionId: string; answer: string | string[] }>,
): string[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
  const missing: string[] = [];

  const isAnswered = (questionId: string) => {
    const answer = answerMap.get(questionId);
    if (answer === undefined) return false;
    return Array.isArray(answer) ? answer.length > 0 : answer.trim() !== '';
  };

  const isRequired = (question: FormQuestion) => {
    if (question.optional) return false;
    if (!question.dependsOn) return true;
    const dependsAnswer = answerMap.get(question.dependsOn.questionId);
    if (Array.isArray(dependsAnswer)) {
      return dependsAnswer.includes(question.dependsOn.value);
    }
    return dependsAnswer === question.dependsOn.value;
  };

  for (const section of sections) {
    for (const question of section.questions) {
      if (isRequired(question) && !isAnswered(question.id)) {
        missing.push(question.label);
      }
    }
  }

  return missing;
}
