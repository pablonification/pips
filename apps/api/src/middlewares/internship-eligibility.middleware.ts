import { createFactory } from 'hono/factory';
import { z } from 'zod';
import { isSpartaEligible } from '~/lib/sparta-window';
import { JWTPayloadSchema } from '~/types/login.types';

export {
  ELIGIBLE_SPARTA_ANGKATAN,
  ELIGIBLE_SPARTA_NIM_OVERRIDES,
} from '~/lib/sparta-window';

const factory = createFactory<{
  Variables: {
    user: z.infer<typeof JWTPayloadSchema>;
  };
}>();

export const internshipEligibilityMiddleware = factory.createMiddleware(
  async (c, next) => {
    if (!isSpartaEligible(c.var.user)) {
      return c.json(
        { error: 'You are not eligible to access SPARTA internship form' },
        401,
      );
    }

    await next();
  },
);
