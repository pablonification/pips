import { z } from '@hono/zod-openapi';
import {
  COLLABORATOR_ROLES,
  EMERGENCY_RELATIONS,
  FORM_LIMITS,
  PROFILE_FIELDS,
  QUESTION_TYPES,
} from '~/lib/form-model';

/** A time as the API sends it (ISO 8601). */
const Time = z.union([z.string(), z.date()]);

export const FormScaleSchema = z
  .object({
    min: z.number().int(),
    max: z.number().int(),
    minLabel: z.string().optional(),
    maxLabel: z.string().optional(),
  })
  .openapi('FormScale');

export const FormQuestionSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string(),
    type: z.enum(QUESTION_TYPES),
    description: z.string().optional(),
    options: z.array(z.string()).optional(),
    other: z.boolean().optional(),
    scale: FormScaleSchema.optional(),
    dependsOn: z
      .object({ questionId: z.string(), value: z.string() })
      .optional(),
    optional: z.boolean().optional(),
    /** The app starts the answer with the member's own name or NIM; they may change it. */
    prefill: z.enum(['fullName', 'nim']).optional(),
  })
  .openapi('FormQuestion');

const FormSectionSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string(),
    description: z.string().optional(),
    questions: z.array(FormQuestionSchema),
  })
  .openapi('FormSection');

const FormAnswerSchema = z
  .object({
    questionId: z.string(),
    answer: z.union([z.string(), z.array(z.string())]),
    /** What the member wrote for "Lainnya", when the answer holds `__other`. */
    other: z.string().optional(),
  })
  .openapi('FormAnswer');

export const ProfileFieldSchema = z
  .enum(PROFILE_FIELDS)
  .openapi('ProfileField');

/** The requested fields' values as a response carries them, by field. */
const ProfileValuesSchema = z
  .record(ProfileFieldSchema, z.string())
  .openapi('ProfileValues');

/** In order of precedence: already_responded, closed (switched off or past closesAt), not_opened, open. */
const FormStatusSchema = z
  .enum(['not_opened', 'open', 'already_responded', 'closed'])
  .openapi('FormStatus');

const personShape = {
  id: z.string(),
  fullName: z.string(),
  nim: z.string(),
  picture: z.string().nullable(),
};
const FormPersonSchema = z.object(personShape).openapi('FormPerson');
// Written out where it may be null: the client generator drops `nullable` on a named schema.
const NullablePersonSchema = z.object(personShape).nullable();

/** A published form as members see it in lists. */
const FormBase = {
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  eligibleAngkatan: z.array(z.number()),
  opensAt: Time,
  closesAt: z.date().nullable(),
  isActive: z.boolean(),
  order: z.number(),
  createdAt: Time,
  /** The profile fields the form sends with an answer; none means no agreement step. */
  requestedFields: z.array(ProfileFieldSchema),
  /** "Ubah jawaban" is offered until the form closes. */
  allowEdit: z.boolean(),
};

const FormListItemSchema = z
  .object({
    ...FormBase,
    status: FormStatusSchema,
    sectionCount: z.number().int(),
  })
  .openapi('FormListItem');

export const ListFormsSchema = z.object({
  forms: z.array(FormListItemSchema),
});

const AdminFormListItemSchema = z.object(FormBase).openapi('AdminFormListItem');

export const AdminListFormsSchema = z.object({
  forms: z.array(AdminFormListItemSchema),
});

export const FormDetailSchema = z
  .object({
    ...FormBase,
    sections: z.array(FormSectionSchema).nullable(),
    status: FormStatusSchema,
    /** The sent screen's words; null shows the app's own. */
    thanks: z.string().nullable(),
    /** Who made it, for the agreement sentence; null for a form made before the builder. */
    owner: z.object({ fullName: z.string() }).nullable(),
    /** Answered, and may still change it: the maker allows it and the form is open. */
    canChange: z.boolean(),
  })
  .openapi('FormDetail');

export const FormIdParamSchema = z.object({
  formId: z.string().openapi({
    param: { in: 'path', description: 'Form id', example: 'abc12345' },
  }),
});

export const FormResponseSchema = z
  .object({
    id: z.string(),
    formId: z.string(),
    userId: z.string(),
    answers: z.array(FormAnswerSchema),
    /** The requested profile fields as they were sent. */
    profile: ProfileValuesSchema,
    submittedAt: Time,
    /** When it was last changed; null if never. */
    updatedAt: z.date().nullable(),
  })
  .openapi('FormResponse');

const EmergencyContactSchema = z
  .object({
    name: z.string().max(FORM_LIMITS.option),
    relation: z.enum(EMERGENCY_RELATIONS),
    phone: z.string().max(30),
  })
  .nullable();

const SavedText = z.string().max(FORM_LIMITS.detail).nullable();

/** A member's saved details (Profil › Data diri); null for one never given. */
export const SavedDetailsSchema = z
  .object({
    whatsapp: SavedText,
    line: SavedText,
    instagram: SavedText,
    address: SavedText,
    hometown: SavedText,
    emergencyContact: EmergencyContactSchema,
    health: SavedText,
    /** `YYYY-MM-DD`. */
    birthDate: SavedText,
    /** An address in the app's storage, JPG or PNG. */
    studentCardPhoto: SavedText,
    photo: SavedText,
  })
  .openapi('SavedDetails');

/** A change to saved details: a value sets one, null removes it, a missing key leaves it. */
export const DetailsChangeSchema = SavedDetailsSchema.partial()
  .strict()
  .openapi('DetailsChange');

export const SubmitFormResponseSchema = z.object({
  /** Leave out a question not answered, and those hidden by their condition. */
  answers: z.array(FormAnswerSchema).max(FORM_LIMITS.questions),
  /** Saved details filled in at the agreement step; they are saved to the member's profile first. */
  details: DetailsChangeSchema.optional(),
  /** The member agreed to send the requested fields. Required when the form requests any. */
  agreed: z.boolean().optional(),
});

export const MyDetailsSchema = z
  .object({
    /** What the account says, never typed: program studi and kampus in words, angkatan as a year. */
    account: z.object({
      fullName: z.string(),
      nim: z.string(),
      major: z.string(),
      angkatan: z.string(),
      campus: z.string(),
      email: z.string(),
    }),
    saved: SavedDetailsSchema,
  })
  .openapi('MyDetails');

export const DetailsProblemsSchema = z
  .object({
    error: z.string(),
    /** Per field: empty, too_long, phone (nine digits at least), date (a real past date), file (a JPG or PNG here). */
    problems: z.record(
      z.string(),
      z.enum(['empty', 'too_long', 'phone', 'date', 'file']),
    ),
  })
  .openapi('DetailsProblems');

export const MissingFieldsSchema = z
  .object({
    error: z.string(),
    /** Requested fields the member hasn't given and didn't send in `details`. */
    missing: z.array(ProfileFieldSchema),
  })
  .openapi('MissingFields');

const AdminFormResponseItemSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    nim: z.string(),
    fullName: z.string(),
    major: z.string(),
    angkatan: z.number(),
    answers: z.array(FormAnswerSchema),
    submittedAt: Time,
  })
  .openapi('AdminFormResponseItem');

const pageQuery = (max: number, fallback: number) => ({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .openapi({ param: { in: 'query' } }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(max)
    .optional()
    .default(fallback)
    .openapi({ param: { in: 'query' } }),
});

export const ListFormResponsesQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .openapi({
      param: { in: 'query', description: 'Search by NIM or name' },
    }),
  ...pageQuery(100, 20),
});

export const ListFormResponsesSchema = z.object({
  responses: z.array(AdminFormResponseItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const FormResponsesCountSchema = z.object({
  total: z.number(),
});

const FormAnalyticsOptionCountSchema = z.object({
  value: z.string(),
  count: z.number(),
});

const FormAnalyticsQuestionSchema = z.object({
  questionId: z.string(),
  label: z.string(),
  type: z.enum(['radio', 'checkbox', 'rating']),
  options: z.array(FormAnalyticsOptionCountSchema),
});

export const FormAnalyticsSchema = z.object({
  totalResponses: z.number(),
  questions: z.array(FormAnalyticsQuestionSchema),
});

// The builder (Kelola › Form): any pengurus.

const ManageStatusSchema = z
  .enum(['draft', 'scheduled', 'open', 'closed'])
  .openapi('FormManageStatus');

const FormAccessSchema = z
  .object({
    /** Their relation to the form: owner, shared with them (view or edit), or none (admin). */
    role: z.enum(['owner', ...COLLABORATOR_ROLES]).nullable(),
    /** Sees the builder read-only and the answers. */
    canView: z.boolean(),
    /** Changes the form, Setelan, its short name, who it is shared with; deletes it. */
    canEdit: z.boolean(),
    /** Admin acting on a form that isn't theirs: say whose it is. */
    asAdmin: z.boolean(),
  })
  .openapi('FormAccess');

const ManageFormListItemSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    status: ManageStatusSchema,
    eligibleAngkatan: z.array(z.number()),
    opensAt: z.date().nullable(),
    closesAt: z.date().nullable(),
    questionCount: z.number().int(),
    responseCount: z.number().int(),
    owner: NullablePersonSchema,
    access: FormAccessSchema,
    updatedAt: Time,
  })
  .openapi('ManageFormListItem');

export const ManageListQuerySchema = z.object({
  scope: z
    .enum(['mine', 'all'])
    .optional()
    .default('mine')
    .openapi({
      param: {
        in: 'query',
        description:
          'mine: made by you or shared with you; all: every form (admin only, 403 otherwise)',
      },
    }),
});

export const ManageListSchema = z.object({
  forms: z.array(ManageFormListItemSchema),
});

export const ManageFormSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    /** Someone chose the short name; until then a draft's follows its title. */
    slugCustom: z.boolean(),
    title: z.string(),
    description: z.string().nullable(),
    sections: z.array(FormSectionSchema),
    requestedFields: z.array(ProfileFieldSchema),
    eligibleAngkatan: z.array(z.number()),
    /** Null on a draft that opens when published. */
    opensAt: z.date().nullable(),
    closesAt: z.date().nullable(),
    isActive: z.boolean(),
    allowEdit: z.boolean(),
    thanks: z.string().nullable(),
    status: ManageStatusSchema,
    publishedAt: z.date().nullable(),
    owner: NullablePersonSchema,
    access: FormAccessSchema,
    responseCount: z.number().int(),
    /** Members in the chosen angkatan ("87 dari 132 anggota"). */
    audience: z.number().int(),
    createdAt: Time,
    updatedAt: Time,
  })
  .openapi('ManageForm');

export const CreateFormSchema = z.object({
  title: z.string().max(FORM_LIMITS.title).optional(),
});

export const UpdateFormSchema = z
  .object({
    title: z.string().max(FORM_LIMITS.title),
    description: z.string().max(FORM_LIMITS.description).nullable(),
    sections: z.array(FormSectionSchema),
    requestedFields: z.array(ProfileFieldSchema),
    eligibleAngkatan: z.array(z.number().int()),
    opensAt: z.string().datetime({ offset: true }).nullable(),
    closesAt: z.string().datetime({ offset: true }).nullable(),
    allowEdit: z.boolean(),
    thanks: z.string().max(FORM_LIMITS.thanks).nullable(),
    /** The maker agreed to lose the answers a breaking edit takes away (409 asks first). */
    confirmBreaking: z.boolean(),
  })
  .partial()
  .openapi('UpdateForm');

const BreakingChangeSchema = z
  .object({
    questionId: z.string(),
    label: z.string(),
    change: z.enum(['removed', 'type']),
  })
  .openapi('BreakingChange');

export const BreakingEditSchema = z
  .object({
    error: z.string(),
    breaking: z.array(BreakingChangeSchema),
    /** How many members' answers would lose these. */
    responseCount: z.number().int(),
  })
  .openapi('BreakingEdit');

export const PublishProblemsSchema = z
  .object({
    error: z.string(),
    problems: z.array(
      z.enum([
        'no_title',
        'no_questions',
        'unwritten_question',
        'one_option',
        'no_angkatan',
        'closes_before_opening',
        'already_closed',
      ]),
    ),
  })
  .openapi('PublishProblems');

export const SlugBodySchema = z.object({ slug: z.string().max(100) });

export const SlugCheckQuerySchema = z.object({
  slug: z
    .string()
    .max(100)
    .openapi({ param: { in: 'query', description: 'The name as typed' } }),
});

const SLUG_PROBLEMS = [
  'too_short',
  'too_long',
  'characters',
  'hyphens',
  'taken',
  'used',
] as const;

export const SlugCheckSchema = z
  .object({
    /** The name tidied as the field does (spaces as hyphens; capitals kept). */
    slug: z.string(),
    available: z.boolean(),
    /**
     * Why not: too_short, too_long, characters, hyphens; taken (a short link or another form holds it, perhaps in
     * other capitals: heldAs); used (a deleted link had it). Null when available. Forms and short links share the names.
     */
    problem: z.enum(SLUG_PROBLEMS).nullable(),
    heldAs: z.string().nullable(),
    heldBy: z.enum(['link', 'form']).nullable(),
  })
  .openapi('SlugCheck');

export const SlugProblemSchema = z
  .object({
    error: z.string(),
    problem: z.enum(SLUG_PROBLEMS),
    heldAs: z.string().optional(),
    heldBy: z.enum(['link', 'form']).optional(),
  })
  .openapi('SlugProblem');

export const FormAccessListSchema = z
  .object({
    owner: NullablePersonSchema,
    people: z.array(
      z.object({ person: FormPersonSchema, role: z.enum(COLLABORATOR_ROLES) }),
    ),
  })
  .openapi('FormAccessList');

export const AccessSearchQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .openapi({ param: { in: 'query', description: 'A name or NIM' } }),
});

export const AccessCandidatesSchema = z
  .object({
    people: z.array(
      z.object({
        person: FormPersonSchema,
        /** Holds a role: only pengurus can be added ("Bukan pengurus" otherwise). */
        isPengurus: z.boolean(),
        /** Their relation to this form now. */
        role: z.enum(['owner', ...COLLABORATOR_ROLES]).nullable(),
      }),
    ),
  })
  .openapi('AccessCandidates');

export const AccessUserParamSchema = FormIdParamSchema.extend({
  userId: z.string().openapi({ param: { in: 'path' } }),
});

export const SetAccessSchema = z.object({ role: z.enum(COLLABORATOR_ROLES) });

const ValueCountSchema = z.object({ value: z.string(), count: z.number() });

export const FormSummarySchema = z
  .object({
    /** Responses received. */
    total: z.number().int(),
    /** Members in the form's angkatan. */
    audience: z.number().int(),
    questions: z.array(
      z.object({
        questionId: z.string(),
        label: z.string(),
        type: z.enum(QUESTION_TYPES),
        answered: z.number().int(),
        /** Every option or scale value in order (with 0); dates and times as given, earliest first. "Lainnya" is `__other`. */
        counts: z.array(ValueCountSchema).optional(),
        average: z.number().nullable().optional(),
        /** Text answers and "Lainnya" lines, newest first, at most 100. */
        texts: z.array(z.string()).optional(),
        files: z
          .array(z.object({ url: z.string(), name: z.string() }))
          .optional(),
      }),
    ),
  })
  .openapi('FormSummary');

export const AnswersQuerySchema = z.object(pageQuery(100, 1));

export const FormAnswersSchema = z
  .object({
    responses: z.array(
      z.object({
        id: z.string(),
        /** Its place in the order they were sent, from 1. */
        number: z.number().int(),
        submittedAt: Time,
        updatedAt: z.date().nullable(),
        /** Only the profile fields the form requested, as the member agreed to send them. */
        profile: ProfileValuesSchema,
        answers: z.array(FormAnswerSchema),
      }),
    ),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  })
  .openapi('FormAnswers');

export const ExportQuerySchema = z.object({
  format: z
    .enum(['xlsx', 'csv'])
    .optional()
    .default('xlsx')
    .openapi({ param: { in: 'query', description: 'Excel by default' } }),
});

export const FormLinkParamSchema = z.object({
  name: z
    .string()
    .max(100)
    .openapi({ param: { in: 'path' } }),
});

export const FormLinkSchema = z
  .object({
    /** form: open it; not_for_you: another angkatan's form; draft: not published, and the reader may manage it. */
    state: z.enum(['form', 'not_for_you', 'draft']),
    formId: z.string(),
    title: z.string(),
    eligibleAngkatan: z.array(z.number()),
    /** May open it in Kelola › Form. */
    canManage: z.boolean(),
  })
  .openapi('FormLink');
