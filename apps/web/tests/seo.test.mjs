// What search engines and link previews read (index.html's head, robots.txt, sitemap.xml, the picture) and the
// Caddyfile rule that keeps members' pages and staging out of search: all name the same production address and the
// same public page, and the picture is what the tags say it is.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const SITE = 'https://app.hmif.dev';
/** The one page anyone may open: sign-in. `/` sends there when signed out. */
const PUBLIC_PAGE = `${SITE}/login`;

const appDir = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(appDir, file), 'utf8');
const html = read('index.html');
const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1];

/** The content of the meta tag with this name or property; fails when there isn't exactly one. */
function meta(key) {
  const tags = [...head.matchAll(/<meta\b([^>]*)\/?>/g)].filter(([, attrs]) =>
    new RegExp(`\\b(?:name|property)="${key.replace(/[.:]/g, '\\$&')}"`).test(
      attrs,
    ),
  );
  assert.equal(tags.length, 1, `exactly one <meta> for ${key}`);
  return /\bcontent="([^"]*)"/.exec(tags[0][1])?.[1];
}

/** Width and height from a PNG's header. */
function pngSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(
    bytes.subarray(1, 4).toString('latin1'),
    'PNG',
    `${file} is a PNG`,
  );
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bytes: bytes.length,
  };
}

test('the head describes PIPS! for search: a title, a description of a length search shows whole, the canonical page', () => {
  assert.match(head, /<title>PIPS!<\/title>/);
  const description = meta('description');
  assert.ok(
    description.length >= 70 && description.length <= 160,
    `description is ${description.length} characters`,
  );
  assert.equal(meta('og:description'), description);
  assert.match(
    head,
    new RegExp(`<link rel="canonical" href="${PUBLIC_PAGE}" />`),
  );
  assert.match(html, /<html lang="id"/);
  assert.equal(meta('og:locale'), 'id_ID');
});

test('the link preview: every Open Graph field a chat app reads, with absolute addresses on production', () => {
  assert.equal(meta('og:type'), 'website');
  assert.equal(meta('og:site_name'), 'PIPS!');
  assert.equal(meta('og:url'), `${SITE}/`);
  assert.match(meta('og:title'), /^PIPS!/);
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.ok(meta('og:image:alt').length > 20);
  assert.equal(meta('twitter:image:alt'), meta('og:image:alt'));
  for (const [, url] of head.matchAll(/content="(https?:\/\/[^"]*)"/g))
    assert.ok(url.startsWith(`${SITE}/`), `${url} is on ${SITE}`);
});

test('the picture exists in public/, is the size and type the tags say, and is small enough for every chat app', () => {
  const image = meta('og:image');
  assert.ok(image.startsWith(`${SITE}/`));
  const file = path.join(appDir, 'public', new URL(image).pathname);
  assert.ok(fs.existsSync(file), `${file} exists`);
  const { width, height, bytes } = pngSize(file);
  assert.equal(meta('og:image:type'), 'image/png');
  assert.deepEqual(
    [width, height],
    [Number(meta('og:image:width')), Number(meta('og:image:height'))],
  );
  assert.deepEqual([width, height], [1200, 630]);
  // WhatsApp leaves out a preview picture over about 300 KB.
  assert.ok(bytes < 300 * 1024, `${bytes} bytes`);
});

test('Google gets an icon at a multiple of 48 px, and the site name from the structured data', () => {
  assert.match(
    head,
    /<link rel="icon" type="image\/png" sizes="192x192" href="\/android-chrome-192x192.png" \/>/,
  );
  assert.ok(
    fs.existsSync(path.join(appDir, 'public/android-chrome-192x192.png')),
  );
  const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
    head,
  )?.[1];
  const site = JSON.parse(json);
  assert.equal(site['@type'], 'WebSite');
  assert.equal(site.name, 'PIPS!');
  assert.equal(site.url, `${SITE}/`);
  assert.ok(
    fs.existsSync(
      path.join(appDir, 'public', new URL(site.publisher.logo).pathname),
    ),
  );
});

test('robots.txt lets crawlers fetch every page (so they see noindex) and names the sitemap, which lists the public page', () => {
  const robots = read('public/robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.doesNotMatch(robots, /^Disallow:/m);
  assert.match(robots, new RegExp(`^Sitemap: ${SITE}/sitemap.xml$`, 'm'));
  const locs = [
    ...read('public/sitemap.xml').matchAll(/<loc>([^<]*)<\/loc>/g),
  ].map((m) => m[1]);
  assert.deepEqual(locs, [PUBLIC_PAGE]);
});

test("the Caddyfile marks every page noindex but production's sign-in and /, by production's host", () => {
  const caddy = read('Caddyfile');
  const block = /@noindex \{([\s\S]*?)\n\t\}/.exec(caddy)?.[1];
  assert.ok(block, '@noindex matcher');
  assert.match(
    block,
    new RegExp(
      `host \\{\\$SITE_HOST:${new URL(SITE).host.replace(/\./g, '\\.')}\\}`,
    ),
  );
  assert.match(block, new RegExp(`path / ${new URL(PUBLIC_PAGE).pathname}\\n`));
  assert.match(caddy, /header @noindex X-Robots-Tag "noindex, nofollow"/);
});

test('the dev server (staging) and vite preview tell search engines to keep out', () => {
  const config = read('vite.config.ts');
  assert.match(
    config,
    /const NOINDEX = \{ 'X-Robots-Tag': 'noindex, nofollow' \}/,
  );
  assert.match(config, /server: \{[\s\S]*?headers: NOINDEX,/);
  assert.match(config, /preview: \{ headers: NOINDEX \}/);
});
