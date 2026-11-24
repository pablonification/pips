import { createRoute, z } from '@hono/zod-openapi';
import {
  AdminShortLinkListQuerySchema,
  AdminShortLinkListSchema,
  ClaimLockedSchema,
  ClaimLoginSchema,
  ClaimLookupSchema,
  ClaimTakenSchema,
  ClaimTakeSchema,
  ClaimWrongSchema,
  CreateShortLinkSchema,
  GiveShortLinkResultSchema,
  GiveShortLinkSchema,
  ShortLinkDestinationSchema,
  ShortLinkIdParamSchema,
  ShortLinkListQuerySchema,
  ShortLinkListSchema,
  ShortLinkNameBodySchema,
  ShortLinkNameCheckQuerySchema,
  ShortLinkNameCheckSchema,
  ShortLinkProblemSchema,
  ShortLinkSchema,
} from '~/types/short-link.types';
import { errorResponse, ErrorSchema } from '~/types/responses.type';

const json = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { content: { 'application/json': { schema } } },
});
const tags = ['short-link'];

export const listShortLinksRoute = createRoute({
  operationId: 'listShortLinks',
  tags,
  method: 'get',
  path: '/short-links',
  description:
    "Tautan pendek: the member's links and their published forms' links, newest made first or most clicked, 50 at a time.",
  request: { query: ShortLinkListQuerySchema },
  responses: {
    200: json('A page of links', ShortLinkListSchema),
    401: errorResponse,
  },
});

export const createShortLinkRoute = createRoute({
  operationId: 'createShortLink',
  tags,
  method: 'post',
  path: '/short-links',
  description:
    'Buat tautan: any member. The name follows the one rule (3 to 50 letters, numbers and hyphens) and is compared without capitals; none gives a random one.',
  request: body(CreateShortLinkSchema),
  responses: {
    201: json('The new link', ShortLinkSchema),
    400: json(
      'A destination or name the link can’t have',
      ShortLinkProblemSchema,
    ),
    401: errorResponse,
    409: json('The name is held, or was', ShortLinkProblemSchema),
  },
});

export const checkShortLinkNameRoute = createRoute({
  operationId: 'checkShortLinkName',
  tags,
  method: 'get',
  path: '/short-links/name-check',
  description:
    'Whether a name is free, while it is typed (about 300 ms after the last key). Saving still decides.',
  request: { query: ShortLinkNameCheckQuerySchema },
  responses: {
    200: json('Whether it is free', ShortLinkNameCheckSchema),
    401: errorResponse,
  },
});

export const listAllShortLinksRoute = createRoute({
  operationId: 'listAllShortLinks',
  tags,
  method: 'get',
  path: '/short-links/all',
  description:
    'Kelola › Tautan pendek (admin): every link with who holds it, or only those nobody holds yet.',
  request: { query: AdminShortLinkListQuerySchema },
  responses: {
    200: json('A page of links', AdminShortLinkListSchema),
    401: errorResponse,
  },
});

export const lookUpShortLinkClaimRoute = createRoute({
  operationId: 'lookUpShortLinkClaim',
  tags,
  method: 'post',
  path: '/short-links/claim/lookup',
  description:
    'Ambil tautan lama, step 1: the old s.hmif.dev username or email and password. Says which links would move; moves nothing. Five wrong passwords lock 15 minutes, per old account and per member.',
  request: body(ClaimLoginSchema),
  responses: {
    200: json('What claiming this account would do', ClaimLookupSchema),
    401: json('Username or password wrong', ClaimWrongSchema),
    410: json('Claiming has ended', ErrorSchema),
    429: json('Too many wrong passwords', ClaimLockedSchema),
  },
});

export const claimShortLinksRoute = createRoute({
  operationId: 'claimShortLinks',
  tags,
  method: 'post',
  path: '/short-links/claim',
  description:
    'Ambil tautan lama, step 2 (Jadikan milikku): every link of the old account nobody holds becomes the member’s, names and clicks kept.',
  request: body(ClaimTakeSchema),
  responses: {
    200: json('How many moved', ClaimTakenSchema),
    400: json('The token is not valid any more', ErrorSchema),
    401: errorResponse,
    409: json('Another member claimed it first', ErrorSchema),
    410: json('Claiming has ended', ErrorSchema),
  },
});

export const getShortLinkRoute = createRoute({
  operationId: 'getShortLink',
  tags,
  method: 'get',
  path: '/short-links/{id}',
  description:
    'A link: for its holder (a form’s link for the form’s maker) and admin; for its last holder, `moved` or `deleted` once an admin moved or deleted it. 404 for anyone else.',
  request: { params: ShortLinkIdParamSchema },
  responses: {
    200: json('The link', ShortLinkSchema),
    401: errorResponse,
    404: errorResponse,
  },
});

export const changeShortLinkDestinationRoute = createRoute({
  operationId: 'changeShortLinkDestination',
  tags,
  method: 'patch',
  path: '/short-links/{id}',
  description:
    'Ubah tujuan: its holder or admin. An admin changing someone else’s link tells them by push.',
  request: {
    params: ShortLinkIdParamSchema,
    ...body(ShortLinkDestinationSchema),
  },
  responses: {
    200: json('The link', ShortLinkSchema),
    400: json('A destination the link can’t have', ShortLinkProblemSchema),
    401: errorResponse,
    404: errorResponse,
    409: json('A form’s link changes in the form', ErrorSchema),
  },
});

export const renameShortLinkRoute = createRoute({
  operationId: 'renameShortLink',
  tags,
  method: 'put',
  path: '/short-links/{id}/name',
  description:
    'Ubah nama: its holder or admin. The old name keeps opening it. An admin renaming someone else’s link tells them by push.',
  request: { params: ShortLinkIdParamSchema, ...body(ShortLinkNameBodySchema) },
  responses: {
    200: json('The link', ShortLinkSchema),
    400: json('A name the link can’t have', ShortLinkProblemSchema),
    401: errorResponse,
    404: errorResponse,
    409: json(
      'The name is held, or was; or the link is a form’s',
      ShortLinkProblemSchema,
    ),
  },
});

export const deleteShortLinkRoute = createRoute({
  operationId: 'deleteShortLink',
  tags,
  method: 'delete',
  path: '/short-links/{id}',
  description:
    'Hapus tautan: its holder or admin. It stops opening, for good, and its names are never given out again. An admin deleting someone else’s link tells them by push.',
  request: { params: ShortLinkIdParamSchema },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponse,
    404: errorResponse,
    409: json('A form’s link goes with the form', ErrorSchema),
  },
});

export const giveShortLinkRoute = createRoute({
  operationId: 'giveShortLink',
  tags,
  method: 'post',
  path: '/short-links/{id}/give',
  description:
    'Berikan ke anggota or Pindahkan (admin), optionally with the old account’s other links nobody holds. The holder it is taken from is told by push.',
  request: { params: ShortLinkIdParamSchema, ...body(GiveShortLinkSchema) },
  responses: {
    200: json('The link, and how many moved', GiveShortLinkResultSchema),
    400: json('No member has that NIM', ErrorSchema),
    401: errorResponse,
    404: errorResponse,
    409: json('A form’s link belongs to the form', ErrorSchema),
  },
});
