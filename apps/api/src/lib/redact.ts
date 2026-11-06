/** Query parameters that carry a secret: a sign-in key, an OAuth code or state, a token. Never logged. */
const SECRET_PARAMS = new Set([
  'token',
  'code',
  'state',
  'key',
  'password',
  'accesstoken',
  'access_token',
  'id_token',
]);

export const REDACTED = 'redacted';

/**
 * A request's query string as the request log may keep it (`?a=1&b=2`, or '' with none): the value of every
 * secret parameter replaced by `redacted`.
 */
export function redactedQuery(url: string) {
  const { searchParams } = new URL(url, 'http://localhost');
  for (const name of new Set(searchParams.keys())) {
    if (SECRET_PARAMS.has(name.toLowerCase())) searchParams.set(name, REDACTED);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
