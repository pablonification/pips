import { sign } from 'hono/jwt';

/** The JWT secret `usePlaceholderEnv()` sets; tokens signed with it pass the API's session check in tests. */
export const PLACEHOLDER_JWT_SECRET = 'placeholder-secret';

export interface TestUser {
  id: string;
  nim: string;
  email: string;
  fullName: string;
  major: 'IF' | 'STI';
  picture: string | null;
  region: 'Ganesha' | 'Jatinangor';
  angkatan: number;
  gender: 'F' | 'M';
  membershipStatus: string;
}

export function testUser(
  id: string,
  overrides: Partial<TestUser> = {},
): TestUser {
  return {
    id,
    nim: '13525001',
    email: `${id}@example.com`,
    fullName: `Member ${id}`,
    major: 'IF',
    picture: null,
    region: 'Ganesha',
    angkatan: 2025,
    gender: 'F',
    membershipStatus: 'anggota',
    ...overrides,
  };
}

/** A `Cookie` header carrying a valid session for `user`, as the API sets it at sign-in. */
export async function sessionCookie(
  user: TestUser,
  secret = PLACEHOLDER_JWT_SECRET,
) {
  const token = await sign(
    { ...user, exp: Math.floor(Date.now() / 1000) + 3600 },
    secret,
    'HS256',
  );
  return `hmif-app.access-cookie=${token}`;
}

/** Finds every key named `key` at any depth (for checks like "no userId anywhere in the response"). */
export function pathsOfKey(value: unknown, key: string, at = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => pathsOfKey(v, key, `${at}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(k === key ? [`${at}.${k}`] : []),
      ...pathsOfKey(v, key, `${at}.${k}`),
    ]);
  }
  return [];
}
