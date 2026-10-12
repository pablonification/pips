const PLACEHOLDER_ORIGIN = 'https://pips.invalid';

/**
 * The `redirect` search param on `/login`, made safe: only a path on this site (with its search and hash), never
 * another origin (`//evil.example`, `https:…`, `/\evil.example`, `javascript:`), and never `/login` itself.
 * Returns undefined when the value can't be used, so sign-in falls back to Beranda.
 */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048)
    return undefined;
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  )
    return undefined;
  // Browsers drop tabs and newlines inside URLs, which can turn "/\t/evil" into "//evil".
  const hasControlOrBackslash = [...value].some((c) => {
    const code = c.charCodeAt(0);
    return code < 0x20 || code === 0x7f || c === '\\';
  });
  if (hasControlOrBackslash) return undefined;
  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return undefined;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return undefined;
  if (url.pathname === '/login' || url.pathname.startsWith('/login/'))
    return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Search params for `/login` that bring the member back to `href` after signing in. Beranda needs none. */
export function loginSearch(href: string): { redirect?: string } {
  const redirect = safeRedirect(href);
  return redirect && redirect !== '/' ? { redirect } : {};
}
