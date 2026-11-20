import { createRoute, z } from '@hono/zod-openapi';
import {
  AccessCandidatesSchema,
  AccessSearchQuerySchema,
  AccessUserParamSchema,
  AdminListFormsSchema,
  AnswersQuerySchema,
  BreakingEditSchema,
  CreateFormSchema,
  DetailsChangeSchema,
  DetailsProblemsSchema,
  ExportQuerySchema,
  FormAccessListSchema,
  FormAnswersSchema,
  FormLinkParamSchema,
  FormLinkSchema,
  FormSummarySchema,
  ManageFormSchema,
  ManageListQuerySchema,
  ManageListSchema,
  MissingFieldsSchema,
  MyDetailsSchema,
  PublishProblemsSchema,
  SetAccessSchema,
  SlugBodySchema,
  SlugCheckQuerySchema,
  SlugCheckSchema,
  SlugProblemSchema,
  UpdateFormSchema,
  FormAnalyticsSchema,
  FormDetailSchema,
  FormIdParamSchema,
  FormResponseSchema,
  FormResponsesCountSchema,
  ListFormResponsesQuerySchema,
  ListFormResponsesSchema,
  ListFormsSchema,
  SubmitFormResponseSchema,
} from '~/types/form.types';
import {
  errorResponse,
  ErrorSchema,
  validationErrorResponse,
  ValidationErrorSchema,
} from '~/types/responses.type';

const submitProblems = {
  description:
    'Bad request: validation, an answer that does not fit (error), a saved detail that does not (problems), requested fields still missing (missing), or no agreement',
  content: {
    'application/json': {
      schema: z.union([
        ValidationErrorSchema,
        ErrorSchema,
        DetailsProblemsSchema,
        MissingFieldsSchema,
      ]),
    },
  },
} as const;

const json = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: { 'application/json': { schema } },
});

export const listFormsRoute = createRoute({
  operationId: 'listForms',
  tags: ['form'],
  method: 'get',
  path: '/form',
  responses: {
    200: {
      description: 'List of forms eligible for the current user',
      content: { 'application/json': { schema: ListFormsSchema } },
    },
    401: errorResponse,
  },
});

export const listAllFormsRoute = createRoute({
  operationId: 'listAllForms',
  tags: ['form'],
  method: 'get',
  path: '/form/admin/list',
  responses: {
    200: {
      description:
        'List of all active forms, regardless of eligibility (admin only)',
      content: { 'application/json': { schema: AdminListFormsSchema } },
    },
    401: errorResponse,
  },
});

export const getFormRoute = createRoute({
  operationId: 'getForm',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}',
  request: { params: FormIdParamSchema },
  responses: {
    200: {
      description:
        "Form detail with your `status`. `sections` is null until the form opens, and for a member outside `eligibleAngkatan` who isn't a form admin; a closed form still has them, for a read-only view.",
      content: { 'application/json': { schema: FormDetailSchema } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

export const getMyFormResponseRoute = createRoute({
  operationId: 'getMyFormResponse',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/my-response',
  request: { params: FormIdParamSchema },
  responses: {
    200: {
      description: 'My response to this form (null if not yet submitted)',
      content: {
        'application/json': { schema: FormResponseSchema.nullable() },
      },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

export const submitFormResponseRoute = createRoute({
  operationId: 'submitFormResponse',
  tags: ['form'],
  method: 'post',
  path: '/form/{formId}/response',
  request: {
    params: FormIdParamSchema,
    body: {
      content: { 'application/json': { schema: SubmitFormResponseSchema } },
    },
  },
  responses: {
    201: {
      description: 'Submitted response',
      content: { 'application/json': { schema: FormResponseSchema } },
    },
    400: submitProblems,
    401: errorResponse,
    403: {
      description:
        'Not for your angkatan, not open yet, or closed (switched off or past closesAt)',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: errorResponse,
    409: {
      description: 'Already submitted a response for this form',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

export const changeFormResponseRoute = createRoute({
  operationId: 'changeFormResponse',
  tags: ['form'],
  method: 'put',
  path: '/form/{formId}/response',
  description:
    'Ubah jawaban: replaces your response, with the same checks as sending it, while the form is open and its maker allows changes. The requested profile fields are sent again as they are now.',
  request: {
    params: FormIdParamSchema,
    body: {
      content: { 'application/json': { schema: SubmitFormResponseSchema } },
    },
  },
  responses: {
    200: {
      description: 'Your changed response',
      content: { 'application/json': { schema: FormResponseSchema } },
    },
    400: submitProblems,
    401: errorResponse,
    403: {
      description: 'Closed, or its maker does not allow changes',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'No such form, or you have not answered it',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

export const listFormResponsesRoute = createRoute({
  operationId: 'listFormResponses',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/responses',
  request: { params: FormIdParamSchema, query: ListFormResponsesQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of responses (admin only)',
      content: { 'application/json': { schema: ListFormResponsesSchema } },
    },
    401: errorResponse,
    400: validationErrorResponse,
  },
});

export const getFormResponsesCountRoute = createRoute({
  operationId: 'getFormResponsesCount',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/responses/count',
  request: { params: FormIdParamSchema },
  responses: {
    200: {
      description: 'Total number of responses (admin only)',
      content: {
        'application/json': { schema: FormResponsesCountSchema },
      },
    },
    401: errorResponse,
  },
});

export const getFormAnalyticsRoute = createRoute({
  operationId: 'getFormAnalytics',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/analytics',
  request: { params: FormIdParamSchema },
  responses: {
    200: {
      description: 'Aggregated analytics per question (admin only)',
      content: { 'application/json': { schema: FormAnalyticsSchema } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

export const openFormLinkRoute = createRoute({
  operationId: 'openFormLink',
  tags: ['form'],
  method: 'get',
  path: '/form-link/{name}',
  description:
    "What app.hmif.dev/f/<name> leads to: the form; another angkatan's form (title and audience only); or the reader's own draft. A name no form has, a draft the reader can't manage, and a renamed form's old name are all 404.",
  request: { params: FormLinkParamSchema },
  responses: {
    200: json('Where the link leads', FormLinkSchema),
    401: errorResponse,
    404: errorResponse,
  },
});

export const getMyDetailsRoute = createRoute({
  operationId: 'getMyDetails',
  tags: ['form'],
  method: 'get',
  path: '/user/details',
  description:
    'Your account facts and saved details (Profil › Data diri), as forms read them.',
  responses: {
    200: json('Your details', MyDetailsSchema),
    401: errorResponse,
  },
});

export const updateMyDetailsRoute = createRoute({
  operationId: 'updateMyDetails',
  tags: ['form'],
  method: 'patch',
  path: '/user/details',
  description:
    'Changes your saved details: a value sets one, null removes it, a missing key leaves it.',
  request: {
    body: { content: { 'application/json': { schema: DetailsChangeSchema } } },
  },
  responses: {
    200: json('Your details', MyDetailsSchema),
    400: json(
      'A detail that does not fit',
      z.union([ValidationErrorSchema, DetailsProblemsSchema]),
    ),
    401: errorResponse,
  },
});

export const listManagedFormsRoute = createRoute({
  operationId: 'listManagedForms',
  tags: ['form'],
  method: 'get',
  path: '/form/manage/list',
  description:
    'Kelola › Form: the forms you made and those shared with you (Buatanku, Dibagikan ke aku), or every form for admin.',
  request: { query: ManageListQuerySchema },
  responses: {
    200: json('Forms you manage', ManageListSchema),
    401: errorResponse,
    403: json('scope=all without the admin role', ErrorSchema),
  },
});

export const createFormRoute = createRoute({
  operationId: 'createForm',
  tags: ['form'],
  method: 'post',
  path: '/form',
  description:
    'Buat form: a draft owned by you, with one untitled section and one question, requesting Nama and NIM.',
  request: {
    body: { content: { 'application/json': { schema: CreateFormSchema } } },
  },
  responses: {
    201: json('The new draft', ManageFormSchema),
    400: validationErrorResponse,
    401: errorResponse,
  },
});

export const getManagedFormRoute = createRoute({
  operationId: 'getManagedForm',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/manage',
  description:
    "The builder's form: its definition, Setelan, link, who you are to it, and its counts. For its owner, the people it is shared with, and admin.",
  request: { params: FormIdParamSchema },
  responses: {
    200: json('The form', ManageFormSchema),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const updateFormRoute = createRoute({
  operationId: 'updateForm',
  tags: ['form'],
  method: 'patch',
  path: '/form/{formId}',
  description:
    "Saves the builder's changes (owner, Edit, admin). On a form with answers, removing a question or changing its kind to one that can't read the old answers answers 409 until `confirmBreaking` is true; then those answers go for good. A draft's short name follows its title until someone chooses one.",
  request: {
    params: FormIdParamSchema,
    body: { content: { 'application/json': { schema: UpdateFormSchema } } },
  },
  responses: {
    200: json('The form', ManageFormSchema),
    400: json(
      'A definition or setting that does not fit',
      z.union([ValidationErrorSchema, ErrorSchema]),
    ),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: json('The edit loses answers: ask first', BreakingEditSchema),
  },
});

export const publishFormRoute = createRoute({
  operationId: 'publishForm',
  tags: ['form'],
  method: 'post',
  path: '/form/{formId}/publish',
  description:
    'Terbitkan: needs a title, written questions, two options on every choice, an angkatan and a closing time after opening. Opens now unless an opening time was set; a short name nobody chose is taken from the title.',
  request: { params: FormIdParamSchema },
  responses: {
    200: json('The published form', ManageFormSchema),
    400: json('What still stops it', PublishProblemsSchema),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: json('Already published', ErrorSchema),
  },
});

export const deleteFormRoute = createRoute({
  operationId: 'deleteForm',
  tags: ['form'],
  method: 'delete',
  path: '/form/{formId}',
  description:
    'Hapus form: the form and every answer, for good (owner, Edit, admin). Its link then leads nowhere.',
  request: { params: FormIdParamSchema },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const checkFormSlugRoute = createRoute({
  operationId: 'checkFormSlug',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/slug-check',
  description:
    'Whether a short name can be this form\'s, while the maker types ("Tersedia"). Saving still decides.',
  request: { params: FormIdParamSchema, query: SlugCheckQuerySchema },
  responses: {
    200: json('Whether it is free', SlugCheckSchema),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const renameFormSlugRoute = createRoute({
  operationId: 'renameFormSlug',
  tags: ['form'],
  method: 'put',
  path: '/form/{formId}/slug',
  description:
    "Changes the form's short name (owner, Edit, admin). The old name is let go: its link no longer opens the form.",
  request: {
    params: FormIdParamSchema,
    body: { content: { 'application/json': { schema: SlugBodySchema } } },
  },
  responses: {
    200: json('The form', ManageFormSchema),
    400: json('Not a short name the link can have', SlugProblemSchema),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: json('Another form holds it', SlugProblemSchema),
  },
});

export const getFormAccessRoute = createRoute({
  operationId: 'getFormAccess',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/access',
  description:
    "Bagikan's Akses pengurus: the owner, then each person with their role.",
  request: { params: FormIdParamSchema },
  responses: {
    200: json('Who has access', FormAccessListSchema),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const searchFormAccessRoute = createRoute({
  operationId: 'searchFormAccess',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/access/search',
  description:
    'People to share with, by name or NIM (3 characters or more), with whether each is pengurus. For those who may share.',
  request: { params: FormIdParamSchema, query: AccessSearchQuerySchema },
  responses: {
    200: json('Members found', AccessCandidatesSchema),
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const setFormAccessRoute = createRoute({
  operationId: 'setFormAccess',
  tags: ['form'],
  method: 'put',
  path: '/form/{formId}/access/{userId}',
  description:
    "Shares the form with a pengurus, or changes their role (owner, Edit, admin). The owner's own row can never change.",
  request: {
    params: AccessUserParamSchema,
    body: { content: { 'application/json': { schema: SetAccessSchema } } },
  },
  responses: {
    200: json('Who has access now', FormAccessListSchema),
    400: json(
      'Not pengurus, or the owner',
      z.union([ValidationErrorSchema, ErrorSchema]),
    ),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const removeFormAccessRoute = createRoute({
  operationId: 'removeFormAccess',
  tags: ['form'],
  method: 'delete',
  path: '/form/{formId}/access/{userId}',
  description:
    'Hapus akses (owner, Edit, admin). The owner can never be removed.',
  request: { params: AccessUserParamSchema },
  responses: {
    200: json('Who has access now', FormAccessListSchema),
    400: json('The owner', ErrorSchema),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const getFormSummaryRoute = createRoute({
  operationId: 'getFormSummary',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/answers/summary',
  description:
    "The Jawaban tab's summary: the count against the audience, and per question its counts, texts or files. For the owner, the people it is shared with, and admin.",
  request: { params: FormIdParamSchema },
  responses: {
    200: json('The summary', FormSummarySchema),
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const listFormAnswersRoute = createRoute({
  operationId: 'listFormAnswers',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/answers',
  description:
    'The responses one by one, oldest first (limit 1 by default), each with only the profile fields it carried and when it was sent.',
  request: { params: FormIdParamSchema, query: AnswersQuerySchema },
  responses: {
    200: json('A page of responses', FormAnswersSchema),
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});

export const exportFormAnswersRoute = createRoute({
  operationId: 'exportFormAnswers',
  tags: ['form'],
  method: 'get',
  path: '/form/{formId}/answers/export',
  description:
    'Every response as a file to download: Excel (.xlsx) by default, or CSV. One row per response, one column per requested field and per question.',
  request: { params: FormIdParamSchema, query: ExportQuerySchema },
  responses: {
    200: {
      description: 'The file, with a Content-Disposition naming it',
      content: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
          schema: z.string().openapi({ format: 'binary' }),
        },
        'text/csv': { schema: z.string() },
      },
    },
    400: validationErrorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
});
