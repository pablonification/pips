import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { EnvSchema } from '../src/configs/env.schema';
import { isDevLoginEnabled } from '../src/lib/dev-login';

// The variables production must already have; everything else has a default.
const required = {
  DATABASE_URL: 'postgres://user:pass@db.example.test:5432/hmif',
  GOOGLE_CLIENT_ID: 'x',
  GOOGLE_CLIENT_SECRET: 'x',
  GOOGLE_CALLBACK_URL: 'https://app.example.test/callback',
  JWT_SECRET: 'a-placeholder-secret-of-32-characters',
  TOKEN_EXPIRATION: '3600',
  R2_ENDPOINT: 'https://r2.example.test',
  R2_PUBLIC_URL: 'https://files.example.test',
  VAPID_PUBLIC_KEY: 'placeholder-public-key',
  VAPID_PRIVATE_KEY: 'placeholder-private-key',
};

const without = (key: keyof typeof required) => {
  const rest: Record<string, string> = { ...required };
  delete rest[key];
  return rest;
};

const fieldErrors = (input: Record<string, string>) => {
  const result = EnvSchema.safeParse(input);
  assert.equal(result.success, false);
  return result.error!.flatten().fieldErrors as Record<string, string[]>;
};

test('the API starts without mail settings, and the old ones are ignored', () => {
  assert.doesNotThrow(() => EnvSchema.parse(required));
  assert.doesNotThrow(() =>
    EnvSchema.parse({
      ...required,
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: '465',
      SMTP_PASS: 'x',
      SMTP_USER: 'not an email',
    }),
  );
});

test('a session length is a whole number of seconds, at least a minute', () => {
  assert.equal(EnvSchema.parse(required).TOKEN_EXPIRATION, 3600);
  assert.equal(
    EnvSchema.parse({ ...required, TOKEN_EXPIRATION: '2592000' })
      .TOKEN_EXPIRATION,
    2592000,
  );
  for (const bad of ['1h', '7d', 'abc', '59', '0', '-60', '90.5', '']) {
    assert.ok(
      fieldErrors({ ...required, TOKEN_EXPIRATION: bad }).TOKEN_EXPIRATION,
      bad,
    );
  }
});

test('the session secret has at least 32 characters', () => {
  for (const bad of ['', 'x', 'placeholder-secret', 'a'.repeat(31)]) {
    assert.ok(fieldErrors({ ...required, JWT_SECRET: bad }).JWT_SECRET, bad);
  }
  assert.doesNotThrow(() =>
    EnvSchema.parse({ ...required, JWT_SECRET: 'a'.repeat(32) }),
  );
});

test('the file store and push keys are required, and a missing one is named as missing', () => {
  for (const key of [
    'R2_ENDPOINT',
    'R2_PUBLIC_URL',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
  ] as const) {
    assert.deepEqual(fieldErrors(without(key))[key], ['Required'], key);
  }
});

test('production defaults: test login off, every interface', () => {
  const env = EnvSchema.parse(required);
  assert.equal(env.APP_ENV, 'production');
  assert.equal(env.ENABLE_TEST_LOGIN, false);
  assert.equal(env.LISTEN_HOST, undefined);
  assert.equal(isDevLoginEnabled(env), false);
});

test('unexpected values never stop the API from starting and never enable test login', () => {
  const env = EnvSchema.parse({
    ...required,
    NODE_ENV: 'staging',
    APP_ENV: 'prod',
    ENABLE_TEST_LOGIN: '1',
    DEV_LOGIN_EMAIL: 'dev@example.test',
    DEV_LOGIN_PASSWORD_HASH: 'salt:hash',
  });
  assert.equal(env.ENABLE_TEST_LOGIN, false);
  assert.equal(isDevLoginEnabled(env), false);
});

test('the shared staging host can turn test login on explicitly', () => {
  const env = EnvSchema.parse({
    ...required,
    APP_ENV: 'staging',
    ENABLE_TEST_LOGIN: 'true',
    DEV_LOGIN_EMAIL: 'dev@example.test',
    DEV_LOGIN_PASSWORD_HASH: 'salt:hash',
    LISTEN_HOST: '127.0.0.1',
  });
  assert.equal(isDevLoginEnabled(env), true);
  assert.equal(env.LISTEN_HOST, '127.0.0.1');
});

// Tracing and profiling every request (a rate of 1.0) costs CPU in a burst, so the default is lower.
test('Sentry samples 10% of requests unless told otherwise, and a bad value falls back', () => {
  const env = EnvSchema.parse(required);
  assert.equal(env.SENTRY_TRACES_SAMPLE_RATE, 0.1);
  assert.equal(env.SENTRY_PROFILES_SAMPLE_RATE, 0.1);
  const set = EnvSchema.parse({
    ...required,
    SENTRY_TRACES_SAMPLE_RATE: '0.25',
    SENTRY_PROFILES_SAMPLE_RATE: '0',
  });
  assert.equal(set.SENTRY_TRACES_SAMPLE_RATE, 0.25);
  assert.equal(set.SENTRY_PROFILES_SAMPLE_RATE, 0);
  for (const bad of ['2', '-1', 'banyak', '']) {
    const env = EnvSchema.parse({
      ...required,
      SENTRY_TRACES_SAMPLE_RATE: bad,
    });
    assert.equal(env.SENTRY_TRACES_SAMPLE_RATE, 0.1, bad);
  }
});

test('database statements time out after 15 s unless told otherwise', () => {
  assert.equal(EnvSchema.parse(required).DB_STATEMENT_TIMEOUT_MS, 15_000);
  const set = EnvSchema.parse({ ...required, DB_STATEMENT_TIMEOUT_MS: '0' });
  assert.equal(set.DB_STATEMENT_TIMEOUT_MS, 0);
  for (const bad of ['-5', 'lama', '1.5', '']) {
    const env = EnvSchema.parse({ ...required, DB_STATEMENT_TIMEOUT_MS: bad });
    assert.equal(env.DB_STATEMENT_TIMEOUT_MS, 15_000, bad);
  }
});
