import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { EnvSchema } from '../src/configs/env.schema';
import { isDevLoginEnabled } from '../src/lib/dev-login';

// The variables production must already have; everything else has a default.
const required = {
  DATABASE_URL: 'postgres://user:pass@db.example.test:5432/hmif',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '465',
  SMTP_PASS: 'x',
  GOOGLE_CLIENT_ID: 'x',
  GOOGLE_CLIENT_SECRET: 'x',
  GOOGLE_CALLBACK_URL: 'https://app.example.test/callback',
  JWT_SECRET: 'x',
  TOKEN_EXPIRATION: '3600',
  // Their defaults ('not-specified') aren't URLs, so these must be set too.
  R2_ENDPOINT: 'https://r2.example.test',
  R2_PUBLIC_URL: 'https://files.example.test',
};

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

// Regression: Sentry traced and profiled every request (1.0), which costs CPU in a burst.
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
