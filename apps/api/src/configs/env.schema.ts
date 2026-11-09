import { z } from '@hono/zod-openapi';

/** A number setting where an empty value (`KEY=`) means unset, so it takes the fallback rather than 0. */
const numberOr = (schema: z.ZodNumber, fallback: number) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema).catch(fallback);

export const EnvSchema = z.object({
  // Lenient on purpose: an unexpected value must never stop the API from starting. Anything other than
  // 'development' or 'staging' counts as production, and anything other than 'true' leaves test login off.
  NODE_ENV: z.string().default('production'),
  APP_ENV: z.string().default('production'),
  ENABLE_TEST_LOGIN: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  DEV_LOGIN_EMAIL: z.string().email().optional(),
  DEV_LOGIN_PASSWORD_HASH: z.string().optional(),
  PORT: z.coerce.number().default(5000),
  // Interface to listen on. Unset listens on all interfaces (containers need that); the shared staging host sets 127.0.0.1.
  LISTEN_HOST: z.string().min(1).optional(),
  // Where the rate limits read the client's address (lib/rate-limit.ts): `x-forwarded-for` (its right-most entry, the
  // nearest proxy's), `cf-connecting-ip` (only when the API is reachable through Cloudflare alone) or `none` (the
  // connection's address). Anything else counts as the default, so a typo never stops the API.
  CLIENT_IP_HEADER: z
    .string()
    .optional()
    .transform((value) => {
      const v = value?.trim().toLowerCase();
      return v === 'cf-connecting-ip' || v === 'none'
        ? v
        : ('x-forwarded-for' as const);
    }),
  DATABASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z
    .string()
    .default('["http://localhost:5173"]')
    .transform((value) => JSON.parse(value))
    .pipe(z.array(z.string().url())),
  VAPID_PUBLIC_KEY: z.string().default('not-specified'),
  VAPID_PRIVATE_KEY: z.string().default('not-specified'),
  VAPID_MAILTO: z.string().email().optional(),
  SMTP_HOST: z.string(),
  SMTP_USER: z.string().email().optional(),
  SMTP_PORT: z.coerce.number(),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_PASS: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  // Other OAuth client ids whose access tokens may sign in (comma-separated), if the web app uses another client.
  GOOGLE_ALLOWED_CLIENT_IDS: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url(),
  JWT_SECRET: z.string(),
  TOKEN_EXPIRATION: z.string(),
  R2_ENDPOINT: z.string().url().default('not-specified'),
  R2_ACCESS_KEY_ID: z.string().default('not-specified'),
  R2_SECRET_ACCESS_KEY: z.string().default('not-specified'),
  R2_PUBLIC_URL: z.string().url().default('not-specified'),
  R2_BUCKET_NAME: z.string().default('hmifapp'),
  // Sign-in as any NIM with this key (`GET /api/auth/login/bypass`). No default: the route exists only on
  // development or staging, and only with a key of at least 32 characters (`lib/login-bypass.ts`).
  LOGIN_BYPASS_KEY: z.string().optional(),
  GOOGLE_CALENDAR_SECRET_PATH: z.string().default('google_credentials.json'),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  SENTRY_DSN: z.string().url().optional(),
  // Share of requests Sentry traces, and of those it profiles (0–1). Anything else falls back to 0.1: tracing and
  // profiling every request costs CPU in a burst.
  SENTRY_TRACES_SAMPLE_RATE: numberOr(z.coerce.number().min(0).max(1), 0.1),
  SENTRY_PROFILES_SAMPLE_RATE: numberOr(z.coerce.number().min(0).max(1), 0.1),
  AXIOM_DATASET: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
  RENOTIFY_DIFF_HOURS: z.coerce.number().optional(),
  // A database statement running longer than this (ms) is cancelled, so a stuck query can't hold a connection for
  // good. 0 turns it off; anything that isn't a whole number ≥ 0 falls back to 15 s.
  DB_STATEMENT_TIMEOUT_MS: numberOr(z.coerce.number().int().min(0), 15_000),
});
