import { z } from '@hono/zod-openapi';
import { DESTINATION_MAX } from '~/lib/short-link';

const NAME_PROBLEMS = [
  'characters',
  'too_short',
  'too_long',
  'hyphens',
  'taken',
  'used',
] as const;

export const ShortLinkNameProblemSchema = z
  .enum(NAME_PROBLEMS)
  .openapi('ShortLinkNameProblem', {
    description:
      'characters (only letters, numbers and hyphens), too_short (under 3), too_long (over 50), hyphens (only between letters or numbers), taken (another link or form holds it, perhaps in other capitals: see heldAs), used (a deleted link had it; never says whose).',
  });

export const ShortLinkIdParamSchema = z.object({
  id: z.string().openapi({ param: { in: 'path', name: 'id' } }),
});

const PageQuery = {
  search: z
    .string()
    .max(100)
    .optional()
    .openapi({
      param: { in: 'query' },
      description: 'Part of a name, destination or form title',
    }),
  order: z
    .enum(['new', 'clicks'])
    .default('new')
    .openapi({
      param: { in: 'query' },
      description: 'Terbaru (newest made first) or Paling diklik',
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .openapi({ param: { in: 'query' } }),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({ param: { in: 'query' } }),
};

export const ShortLinkListQuerySchema = z.object(PageQuery);

export const AdminShortLinkListQuerySchema = z.object({
  ...PageQuery,
  search: PageQuery.search.openapi({
    param: { in: 'query' },
    description:
      "Part of a name, destination, form title, holder's name or NIM, or old account",
  }),
  view: z
    .enum(['all', 'unclaimed'])
    .default('all')
    .openapi({
      param: { in: 'query' },
      description:
        'Semua, or Belum diambil (an old account’s links nobody holds yet)',
    }),
});

const PersonSchema = z
  .object({ id: z.string(), fullName: z.string(), nim: z.string() })
  .openapi('ShortLinkPerson');

const FormRefSchema = z
  .object({ id: z.string(), title: z.string() })
  .openapi('ShortLinkForm');

export const ShortLinkSummarySchema = z
  .object({
    id: z.string(),
    /** The current name: s.hmif.dev/<name>. */
    name: z.string(),
    /** Where it goes; null for a form's link. */
    destination: z.string().nullable(),
    /** A form's link opens the form and is changed in the form, not here. */
    form: FormRefSchema.nullable(),
    clicks: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('ShortLinkSummary');

export const ShortLinkListSchema = z
  .object({
    links: z.array(ShortLinkSummarySchema),
    total: z.number().int(),
    /** Claiming old links: whether it is still open, and until when (null: no end set). */
    claim: z.object({
      open: z.boolean(),
      until: z.string().datetime().nullable(),
    }),
  })
  .openapi('ShortLinkList');

export const AdminShortLinkSummarySchema = ShortLinkSummarySchema.extend({
  /** Who holds it (a form's link: the form's maker); null while nobody in PIPS! does. */
  owner: PersonSchema.nullable(),
  /** The old s.hmif.dev account it came from, if any. */
  oldAccount: z.string().nullable(),
}).openapi('AdminShortLinkSummary');

export const AdminShortLinkListSchema = z
  .object({
    links: z.array(AdminShortLinkSummarySchema),
    total: z.number().int(),
    /** For Belum diambil: how many old accounts those links come from ("27 tautan dari 8 akun lama"). */
    accounts: z.number().int().nullable(),
  })
  .openapi('AdminShortLinkList');

export const ShortLinkSchema = z
  .object({
    /**
     * `own`: the link, for its holder or admin. `moved`: an admin gave it to someone else (only its last holder sees
     * this, with `movedTo`). `deleted`: deleted (its last holder sees this). Both say what happened, once, where a
     * push opens.
     */
    state: z.enum(['own', 'moved', 'deleted']),
    id: z.string(),
    name: z.string(),
    /** Its older names, newest first: they keep opening it. */
    olderNames: z.array(z.string()),
    destination: z.string().nullable(),
    form: FormRefSchema.nullable(),
    clicks: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    /** Whether the destination and name can be changed here (not a form's link). */
    canEdit: z.boolean(),
    /** For admin: who holds it. */
    owner: PersonSchema.nullable(),
    /** For admin: its old account, and how many other links of it nobody holds yet ("Juga 2 tautan lain …"). */
    oldAccount: z
      .object({ username: z.string(), otherUnclaimed: z.number().int() })
      .nullable(),
    /** For `moved`: the new holder's name. */
    movedTo: z.string().nullable(),
  })
  .openapi('ShortLink');

export const CreateShortLinkSchema = z
  .object({
    destination: z.string().max(DESTINATION_MAX + 100),
    /** Empty or missing: a random name. */
    name: z.string().max(200).optional(),
  })
  .openapi('CreateShortLink');

export const ShortLinkDestinationSchema = z
  .object({ destination: z.string().max(DESTINATION_MAX + 100) })
  .openapi('ShortLinkDestination');

export const ShortLinkNameBodySchema = z
  .object({ name: z.string().max(200) })
  .openapi('ShortLinkNameBody');

export const ShortLinkProblemSchema = z
  .object({
    error: z.string(),
    /** For the name. */
    problem: ShortLinkNameProblemSchema.optional(),
    /** For `taken`: the name as the other link or form holds it, and which it is. */
    heldAs: z.string().optional(),
    heldBy: z.enum(['link', 'form']).optional(),
    /** For the destination: invalid (a whole http(s) address), self (already an s.hmif.dev link). */
    destination: z.enum(['invalid', 'self']).optional(),
  })
  .openapi('ShortLinkProblem');

export const ShortLinkNameCheckQuerySchema = z.object({
  name: z
    .string()
    .max(200)
    .openapi({ param: { in: 'query' }, description: 'The name as typed' }),
  linkId: z
    .string()
    .optional()
    .openapi({
      param: { in: 'query' },
      description: 'Renaming this link: its own names are free to it',
    }),
});

export const ShortLinkNameCheckSchema = z
  .object({
    /** The name tidied as the field does (spaces as hyphens; capitals kept). */
    name: z.string(),
    available: z.boolean(),
    problem: ShortLinkNameProblemSchema.nullable(),
    heldAs: z.string().nullable(),
    heldBy: z.enum(['link', 'form']).nullable(),
  })
  .openapi('ShortLinkNameCheck');

export const GiveShortLinkSchema = z
  .object({
    /** The member it goes to, found by name or NIM (NIM Finder). */
    nim: z.string().min(1).max(20),
    /** Also the old account's other links nobody holds yet. */
    withAccount: z.boolean().default(false),
  })
  .openapi('GiveShortLink');

export const GiveShortLinkResultSchema = z
  .object({ moved: z.number().int(), link: ShortLinkSchema })
  .openapi('GiveShortLinkResult');

export const ClaimLoginSchema = z
  .object({
    /** The old s.hmif.dev username or email. */
    login: z.string().min(1).max(200),
    password: z.string().min(1).max(200),
  })
  .openapi('ShortLinkClaimLogin');

export const ClaimLookupSchema = z
  .object({
    /**
     * found: these links would move (take them with `token`). empty: the account has none left. taken: another member
     * took them (`claimedAt`; never who). mine: they are already yours. two_factor: the account had two-step sign-in,
     * so an admin moves its links.
     */
    state: z.enum(['found', 'empty', 'taken', 'mine', 'two_factor']),
    account: z.string(),
    links: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        destination: z.string().nullable(),
        clicks: z.number().int(),
      }),
    ),
    claimedAt: z.string().datetime().nullable(),
    /** For `found`: proof of the password for the next 10 minutes, so it is never sent twice. */
    token: z.string().nullable(),
  })
  .openapi('ShortLinkClaimLookup');

export const ClaimWrongSchema = z
  .object({
    error: z.string(),
    /** Tries left before 15 minutes locked ("Sisa 2 percobaan" from the third wrong one). */
    triesLeft: z.number().int(),
  })
  .openapi('ShortLinkClaimWrong');

/**
 * 429. With `until`: too many wrong passwords, locked until then (Terlalu banyak percobaan. Coba lagi pukul HH.MM).
 * Without it: busy, try again shortly; this member's previous lookup is still running, or the API is comparing as
 * many passwords as it runs at once. Nothing was compared or counted.
 */
export const ClaimLockedSchema = z
  .object({ error: z.string(), until: z.string().datetime().optional() })
  .openapi('ShortLinkClaimLocked');

export const ClaimTakeSchema = z
  .object({ token: z.string().min(1).max(2000) })
  .openapi('ShortLinkClaimTake');

export const ClaimTakenSchema = z
  .object({ moved: z.number().int() })
  .openapi('ShortLinkClaimTaken');
