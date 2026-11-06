import { GoogleUserSchema } from '~/types/login.types';

/** A Google access token that wasn't issued to PIPS!, has expired, or Google doesn't recognise. */
export class InvalidGoogleTokenError extends Error {
  constructor() {
    super('Invalid Google token');
    this.name = 'InvalidGoogleTokenError';
  }
}

/** The client ids whose tokens sign in: `GOOGLE_CLIENT_ID`, plus any in `GOOGLE_ALLOWED_CLIENT_IDS` (comma-separated). */
export function allowedGoogleClientIds(config: {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_ALLOWED_CLIENT_IDS?: string;
}) {
  return [
    config.GOOGLE_CLIENT_ID,
    ...(config.GOOGLE_ALLOWED_CLIENT_IDS ?? '').split(','),
  ]
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * The Google account behind an access token, only if the token was issued to one of `clientIds`. Any website's
 * Google sign-in yields an access token for the same person; without this check, a site that got one could sign
 * in to PIPS! as them. Google's tokeninfo names the token's client (`aud`, `azp`) and its time left.
 */
export async function googleUserFromAccessToken(
  accessToken: string,
  clientIds: readonly string[],
  fetchImpl: typeof fetch = fetch,
) {
  const info = await fetchImpl(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!info.ok) throw new InvalidGoogleTokenError();
  const {
    aud,
    azp,
    expires_in: expiresIn,
  } = (await info.json()) as {
    aud?: string;
    azp?: string;
    expires_in?: string | number;
  };
  const issuedToUs =
    (aud !== undefined && clientIds.includes(aud)) ||
    (azp !== undefined && clientIds.includes(azp));
  if (!issuedToUs || !(Number(expiresIn) > 0)) {
    throw new InvalidGoogleTokenError();
  }

  const userInfo = await fetchImpl(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!userInfo.ok) throw new InvalidGoogleTokenError();
  return GoogleUserSchema.parse(await userInfo.json());
}
