// What search engines and link previews read (index.html's head, the head LINE's crawler gets, robots.txt,
// sitemap.xml, the pictures) and the Caddyfile rules that route LINE and keep members' pages and staging out of
// search. All of them name the same production address and the same public page, and each picture is what its tags
// say it is.
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

/** The content of the meta tag in `inHead` with this name or property; fails when there isn't exactly one. */
function metaIn(inHead, key) {
  const tags = [...inHead.matchAll(/<meta\b([^>]*)\/?>/g)].filter(([, attrs]) =>
    new RegExp(`\\b(?:name|property)="${key.replace(/[.:]/g, '\\$&')}"`).test(
      attrs,
    ),
  );
  assert.equal(tags.length, 1, `exactly one <meta> for ${key}`);
  return /\bcontent="([^"]*)"/.exec(tags[0][1])?.[1];
}
const meta = (key) => metaIn(head, key);

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

test('the head describes PIPS! for search with a title, a description of a length search shows whole, and the canonical page', () => {
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

test('the link preview has every Open Graph field a chat app reads, with absolute addresses on production', () => {
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

const squareHtml = read('public/preview-square.html');
const squareHead = /<head>([\s\S]*?)<\/head>/.exec(squareHtml)[1];

test("LINE's head says what index.html says, with the HMIF logo as a square picture", () => {
  for (const key of [
    'description',
    'og:type',
    'og:site_name',
    'og:locale',
    'og:url',
    'og:title',
    'og:description',
  ])
    assert.equal(metaIn(squareHead, key), meta(key), key);
  assert.match(squareHead, /<title>PIPS!<\/title>/);
  assert.match(
    squareHead,
    new RegExp(`<link rel="canonical" href="${PUBLIC_PAGE}" />`),
  );
  const image = metaIn(squareHead, 'og:image');
  assert.equal(image, `${SITE}/og-image-square.png`);
  const { width, height, bytes } = pngSize(
    path.join(appDir, 'public', new URL(image).pathname),
  );
  assert.equal(width, height, 'square');
  assert.deepEqual(
    [width, height],
    [
      Number(metaIn(squareHead, 'og:image:width')),
      Number(metaIn(squareHead, 'og:image:height')),
    ],
  );
  assert.ok(width >= 200 && bytes < 300 * 1024);
  assert.equal(metaIn(squareHead, 'og:image:alt'), 'Logo HMIF ITB');
});

test('the words a preview shows have no colon in the middle of a sentence', () => {
  for (const [name, h] of [
    ['index.html', head],
    ['preview-square.html', squareHead],
  ])
    for (const key of [
      'description',
      'og:title',
      'og:description',
      'og:image:alt',
    ]) {
      const text = metaIn(h, key);
      assert.doesNotMatch(text, /:\s/, `${name} ${key}: ${text}`);
    }
});

test("the Caddyfile gives LINE's crawler the square head, and everyone else, LINE's in-app browser too, index.html", () => {
  const caddy = read('Caddyfile');
  const line = /@linePreview \{([\s\S]*?)\n\t\}/.exec(caddy)?.[1];
  assert.match(line, /header_regexp User-Agent \(\?i\)line-poker/);
  assert.match(caddy, /rewrite @linePreview \/preview-square\.html/);
  const app = /@app \{([\s\S]*?)\n\t\}/.exec(caddy)?.[1];
  assert.match(app, /not header_regexp User-Agent \(\?i\)line-poker/);
  assert.doesNotMatch(
    'Mozilla/5.0 (iPhone) Mobile Line/14.18.0',
    /line-poker/i,
  );
  assert.match(
    caddy,
    /header \/preview-square\.html X-Robots-Tag "noindex, nofollow"/,
  );
});
