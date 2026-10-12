import { z } from '@hono/zod-openapi';

/** A programme or campaign open now for the signed-in member. The eligibility lists stay on the server. */
export const ProgrammeWindowSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    kind: z.enum(['programme', 'campaign']),
    label: z.string(),
    route: z.string().openapi({
      description: 'An app path (starting with /) or an https:// address',
    }),
    opensAt: z.date(),
    closesAt: z.date().nullable(),
  })
  .openapi('ProgrammeWindow');

export const ListProgrammeWindowsSchema = z
  .object({ windows: z.array(ProgrammeWindowSchema) })
  .openapi('ListProgrammeWindows');
