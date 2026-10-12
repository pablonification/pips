import webpush from 'web-push';

/**
 * Replaces every setting the API reads with a harmless placeholder, and stops `dotenv` from loading a local
 * `.env`, so the result never depends on the machine. For tests and for generating the OpenAPI document:
 * nothing here can reach a real database, mail server, Google, Sentry or storage. The database address leads
 * nowhere, and the VAPID pair is a throwaway made on the spot.
 */
export function usePlaceholderEnv(overrides: Record<string, string> = {}) {
  const vapid = webpush.generateVAPIDKeys();
  const placeholders: Record<string, string> = {
    DATABASE_URL: 'postgres://placeholder:placeholder@127.0.0.1:9/placeholder',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '9',
    SMTP_PASS: 'placeholder',
    GOOGLE_CLIENT_ID: 'placeholder',
    GOOGLE_CLIENT_SECRET: 'placeholder',
    GOOGLE_CALLBACK_URL: 'http://127.0.0.1:9/callback',
    JWT_SECRET: 'placeholder-secret',
    TOKEN_EXPIRATION: '1h',
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
    VAPID_MAILTO: 'placeholder@example.com',
    R2_ENDPOINT: 'http://127.0.0.1:9',
    R2_PUBLIC_URL: 'http://127.0.0.1:9',
    NODE_ENV: 'production',
    APP_ENV: 'production',
    ENABLE_TEST_LOGIN: 'false',
    ALLOWED_ORIGINS: '["http://localhost:5173"]',
    ...overrides,
  };
  process.env.DOTENV_CONFIG_PATH = '/nonexistent/pips-placeholder.env';
  for (const key of [
    'SENTRY_DSN',
    'AXIOM_DATASET',
    'AXIOM_TOKEN',
    'LISTEN_HOST',
    'DEV_LOGIN_EMAIL',
    'DEV_LOGIN_PASSWORD_HASH',
  ]) {
    if (!(key in overrides)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(placeholders)) {
    process.env[key] = value;
  }
  return placeholders;
}
