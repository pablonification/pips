const PLACEHOLDER_ORIGIN = 'https://pips.invalid';

const hasControl = (value: string) =>
  [...value].some((c) => {
    const code = c.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

/** Every form a path can take on its way through a router or a browser: as written and percent-decoded. */
function decodings(path: string) {
  const forms = [path];
  let current = path;
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next === current) break;
    forms.push(next);
    current = next;
  }
  return forms;
}

/** A path on this site in every form: one leading slash, no backslash, no control character. */
function isAppPath(path: string) {
  const forms = decodings(path);
  return (
    forms !== null &&
    forms.every(
      (form) =>
        form.startsWith('/') &&
        !form.startsWith('//') &&
        !form.includes('\\') &&
        !hasControl(form),
    )
  );
}

/**
 * The `redirect` search param on `/login`, made safe: only a path on this site (with its search and hash), never
 * another origin (`//evil.example`, `https:…`, `/\evil.example`, `javascript:`), and never `/login` itself.
 * Both the input and the resolved path are checked: dot segments (`/.//evil.example`, `/%2e%2e//evil.example`)
 * resolve to `//evil.example`, and encoded slashes or backslashes turn into real ones when a router decodes them.
 * Returns undefined when the value can't be used, so sign-in falls back to Beranda.
 */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048)
    return undefined;
  // Browsers drop tabs and newlines inside URLs, which can turn "/\t/evil" into "//evil".
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  if (value.includes('\\') || hasControl(value)) return undefined;
  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return undefined;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN || !isAppPath(url.pathname))
    return undefined;
  if (url.pathname === '/login' || url.pathname.startsWith('/login/'))
    return undefined;
  const result = `${url.pathname}${url.search}${url.hash}`;
  // Parsed again, the result must stay on this site and keep its path.
  const again = new URL(result, PLACEHOLDER_ORIGIN);
  if (again.origin !== PLACEHOLDER_ORIGIN || again.pathname !== url.pathname)
    return undefined;
  return result;
}

/** Search params for `/login` that bring the member back to `href` after signing in. Beranda needs none. */
export function loginSearch(href: string): { redirect?: string } {
  const redirect = safeRedirect(href);
  return redirect && redirect !== '/' ? { redirect } : {};
}
