// The web image's server (Caddyfile, Dockerfile) as text, and the content policy it sends (scripts/csp.mjs). CI's
// docker job runs the image and checks the same answers over HTTP.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { contentSecurityPolicy, caddyHeader } from '../scripts/csp.mjs';

const read = (f) =>
  fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const caddyfile = read('Caddyfile');
const dockerfile = read('Dockerfile');
const directives = (policy) =>
  Object.fromEntries(
    policy.split(';').map((d) => {
      const [name, ...sources] = d.trim().split(/\s+/);
      return [name, sources];
    }),
  );

test('the server compresses what it sends', () => {
  assert.match(caddyfile, /^\s*encode zstd gzip\s*$/m);
});

test('only paths that are not build files fall back to index.html', () => {
  assert.doesNotMatch(caddyfile, /try_files \{path\} \/index\.html/);
  const app = /@app \{([\s\S]*?)\}/.exec(caddyfile)?.[1];
  assert.ok(app, 'no @app matcher');
  assert.match(app, /not path \/assets\/\*/);
  assert.match(app, /not path_regexp/);
  assert.match(app, /not file/);
  assert.match(caddyfile, /rewrite @app \/index\.html/);
});

test('every response carries the protective headers', () => {
  for (const [name, value] of [
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['X-Frame-Options', 'DENY'],
  ])
    assert.match(
      caddyfile,
      new RegExp(`^\\s*header ${name} "?${value}"?\\s*$`, 'm'),
    );
  assert.match(caddyfile, /^\s*import \/etc\/caddy\/csp\.caddy\s*$/m);
  assert.match(
    dockerfile,
    /node apps\/web\/scripts\/csp\.mjs apps\/web\/dist\/index\.html > /,
  );
  assert.match(dockerfile, /COPY --from=build \S+ \/etc\/caddy\/csp\.caddy/);
});

test('the policy is report-only, so it changes nothing for members until it is switched on', () => {
  assert.match(
    caddyHeader('default-src x'),
    /^header Content-Security-Policy-Report-Only "default-src x"$/,
  );
});

const html = `<!doctype html><head><script data-theme-prepaint>
  (function () { document.documentElement.classList.add('x'); })();
</script><script type="module" crossorigin src="/assets/index-a.js"></script></head>`;
const theme = `\n  (function () { document.documentElement.classList.add('x'); })();\n`;

test('the policy allows the app, Google sign-in, the API and its socket, the file store and Sentry', () => {
  const p = directives(
    contentSecurityPolicy({
      html,
      apiUrl: 'https://app-api.example.test',
      mediaUrl: 'https://media.example.test/files',
      sentryDsn: 'https://key@o1.ingest.sentry.io/42',
    }),
  );
  const hash = `'sha256-${createHash('sha256').update(theme).digest('base64')}'`;
  assert.deepEqual(p['script-src'], [
    "'self'",
    hash,
    'https://accounts.google.com/gsi/client',
  ]);
  assert.deepEqual(p['style-src'], [
    "'self'",
    "'unsafe-inline'",
    'https://accounts.google.com/gsi/style',
  ]);
  assert.deepEqual(p['img-src'], [
    "'self'",
    'data:',
    'blob:',
    'https://lh3.googleusercontent.com',
    'https://media.example.test',
  ]);
  assert.deepEqual(p['connect-src'], [
    "'self'",
    'https://accounts.google.com/gsi/',
    'https://*.r2.cloudflarestorage.com',
    'https://app-api.example.test',
    'wss://app-api.example.test',
    'https://o1.ingest.sentry.io',
  ]);
  assert.deepEqual(p['frame-src'], [
    'https://accounts.google.com/gsi/',
    'https://docs.google.com',
    'https://forms.gle',
  ]);
  assert.deepEqual(p['frame-ancestors'], ["'none'"]);
  assert.deepEqual(p['object-src'], ["'none'"]);
  assert.deepEqual(p['font-src'], ["'self'"]);
});

test('without an API address, file store or DSN the policy names none of them', () => {
  const p = directives(
    contentSecurityPolicy({ html, apiUrl: '', mediaUrl: '', sentryDsn: '' }),
  );
  assert.deepEqual(p['connect-src'], [
    "'self'",
    'https://accounts.google.com/gsi/',
    'https://*.r2.cloudflarestorage.com',
  ]);
  assert.deepEqual(p['img-src'], [
    "'self'",
    'data:',
    'blob:',
    'https://lh3.googleusercontent.com',
  ]);
});

test("the policy hashes the theme script of the app's own index.html", () => {
  const source = read('index.html');
  const body = /<script data-theme-prepaint>([\s\S]*?)<\/script>/.exec(
    source,
  )[1];
  const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
  const p = directives(contentSecurityPolicy({ html: source }));
  assert.deepEqual(p['script-src'], [
    "'self'",
    hash,
    'https://accounts.google.com/gsi/client',
  ]);
});

test('vercel.json forwards nothing to sparta.hmif.dev', () => {
  assert.doesNotMatch(read('vercel.json'), /sparta/);
});
