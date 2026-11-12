// The web image's Content-Security-Policy, built from the same values as the app: the API's address and socket
// (VITE_API_URL), the file store (VITE_MEDIA_URL), Sentry (VITE_SENTRY_DSN) and the inline theme script of the built
// index.html, by its hash. The Dockerfile writes it as a Caddyfile line that the Caddyfile imports:
//   node scripts/csp.mjs dist/index.html > csp.caddy
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const origin = (url) => {
  try {
    return url ? new URL(url).origin : '';
  } catch {
    return '';
  }
};

/** The hashes of the inline scripts in `html` (scripts without `src`). */
function inlineScriptHashes(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => !/\bsrc=/.test(attrs))
    .map(
      ([, , body]) =>
        `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
    );
}

export function contentSecurityPolicy({
  html,
  apiUrl = '',
  mediaUrl = '',
  sentryDsn = '',
}) {
  const api = origin(apiUrl);
  const media = origin(mediaUrl);
  const sentry = origin(sentryDsn);
  const policy = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      ...inlineScriptHashes(html),
      'https://accounts.google.com/gsi/client',
    ],
    // React and the Garis components set style attributes.
    'style-src': [
      "'self'",
      "'unsafe-inline'",
      'https://accounts.google.com/gsi/style',
    ],
    // Members' Google photos, files from the store, and pictures picked for an upload before it is sent.
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://lh3.googleusercontent.com',
      media,
    ],
    'font-src': ["'self'"],
    // Uploads go straight to storage, at the address the API signs (R2's, not the file store's public one).
    'connect-src': [
      "'self'",
      'https://accounts.google.com/gsi/',
      'https://*.r2.cloudflarestorage.com',
      api,
      api.replace(/^http/, 'ws'),
      sentry,
    ],
    // Google sign-in, and a Google Form shown in a post.
    'frame-src': [
      'https://accounts.google.com/gsi/',
      'https://docs.google.com',
      'https://forms.gle',
    ],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(policy)
    .map(([name, sources]) =>
      [name, ...new Set(sources.filter(Boolean))].join(' '),
    )
    .join('; ');
}

/**
 * The Caddyfile line. Report-only: browsers report what the policy would block and block nothing. Switch the name to
 * Content-Security-Policy only after a real Google sign-in, an upload and a post with a picture on staging show no
 * report in the browser's console.
 */
export function caddyHeader(policy) {
  return `header Content-Security-Policy-Report-Only "${policy}"`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(process.argv[2] ?? 'dist/index.html', 'utf8');
  const policy = contentSecurityPolicy({
    html,
    apiUrl: process.env.VITE_API_URL,
    mediaUrl: process.env.VITE_MEDIA_URL,
    sentryDsn: process.env.VITE_SENTRY_DSN,
  });
  console.log(caddyHeader(policy));
}
