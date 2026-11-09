import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { env } from '~/configs/env.config';
import { db } from '~/db/drizzle';
import { angkatan, users } from '~/db/schema';
import { isDevLoginEnabled, verifyDevPassword } from '~/lib/dev-login';
import * as Sentry from '@sentry/node';
import {
  allowedGoogleClientIds,
  googleUserFromAccessToken,
  InvalidGoogleTokenError,
} from '~/lib/google-token';
import { JWT_ALG } from '~/lib/jwt';
import {
  bypassTokenMatches,
  bypassTokenMatches as sameSecret,
  isLoginBypassEnabled,
} from '~/lib/login-bypass';
import { SESSION_COOKIE, sessionCookieOptions } from '~/lib/session-cookie';
import {
  findUserByEmail,
  getUserAndUpdatePicture,
  getUserGroups,
  updateUserLastLogin,
} from '~/repositories/auth.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  GoogleTokenDataSchema,
  GoogleUserSchema,
  JWTPayloadSchema,
} from '~/types/login.types';
import {
  authCallbackRoute,
  devLoginRoute,
  getUserGroupsRoute,
  loginAccessTokenRoute,
  loginBypassRoute,
  loginRoute,
  logoutRoute,
  selfRoute,
} from '../routes/auth.route';
import { createAuthRouter, createRouter } from './router-factory';

export const loginRouter = createRouter();

const OAUTH_STATE_COOKIE = 'hmif-app.oauth-state';
export const loginProtectedRouter = createAuthRouter();

const generateJWT = async (payload: object) => {
  const now = Date.now();
  return await sign(
    {
      ...payload,
      exp: now.valueOf() / 1000 + parseInt(env.TOKEN_EXPIRATION),
    },
    env.JWT_SECRET,
    JWT_ALG,
  );
};

loginRouter.openapi(loginRoute, async (c) => {
  const authorizationUrl = new URL(
    'https://accounts.google.com/o/oauth2/v2/auth',
  );

  // Make sure you define all of the google env in your .env file
  authorizationUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID || '');
  authorizationUrl.searchParams.set(
    'redirect_uri',
    env.GOOGLE_CALLBACK_URL || '',
  );
  authorizationUrl.searchParams.set('prompt', 'consent');
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile');
  authorizationUrl.searchParams.set('access_type', 'offline');
  // Ties Google's answer to this browser: the callback accepts only the state it finds in this cookie.
  const state = randomBytes(24).toString('base64url');
  authorizationUrl.searchParams.set('state', state);
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    path: '/api/auth/google/callback',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 10 * 60,
  });

  return c.redirect(authorizationUrl.toString(), 302); // Redirect the user to Google Login
});

loginRouter.openapi(loginAccessTokenRoute, async (c) => {
  const { accessToken } = c.req.valid('json');
  let userInfo;
  try {
    // Only a token issued to PIPS! (lib/google-token.ts).
    userInfo = await googleUserFromAccessToken(
      accessToken,
      allowedGoogleClientIds(env),
    );
  } catch (err) {
    if (err instanceof InvalidGoogleTokenError) {
      return c.json({ error: 'Invalid Google token' }, 401);
    }
    Sentry.captureException(err);
    return c.json({ error: 'Something went wrong' }, 500);
  }
  // Find user in db, if not found return forbidden
  const { email, picture } = userInfo;
  const user = await getUserAndUpdatePicture(db, email, picture);
  if (!user) {
    return c.json(
      {
        error: 'User not found in database',
      },
      401,
    );
  }

  // Create cookie
  const tokenPayload = JWTPayloadSchema.parse(user);
  const token = await generateJWT(tokenPayload);

  void updateUserLastLogin(db, user.id);

  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions());
  return c.json(tokenPayload, 200);
});

loginRouter.openapi(authCallbackRoute, async (c) => {
  const { code, state } = c.req.valid('query');
  const expected = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/api/auth/google/callback' });
  if (!state || !expected || !sameSecret(state, expected)) {
    return c.json({ error: 'Invalid sign-in state' }, 400);
  }

  const tokenEndpoint = new URL('https://accounts.google.com/o/oauth2/token');
  tokenEndpoint.searchParams.set('code', code);
  tokenEndpoint.searchParams.set('grant_type', 'authorization_code');

  // Make sure you define all of the google env in your .env file
  tokenEndpoint.searchParams.set('client_id', env.GOOGLE_CLIENT_ID || '');
  tokenEndpoint.searchParams.set(
    'client_secret',
    env.GOOGLE_CLIENT_SECRET || '',
  );
  tokenEndpoint.searchParams.set('redirect_uri', env.GOOGLE_CALLBACK_URL || '');

  // Fetch Token from Google Token endpoint and parse it into GoogleTokenDataSchema
  const tokenResponse = await fetch(
    tokenEndpoint.origin + tokenEndpoint.pathname,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenEndpoint.searchParams.toString(),
    },
  );
  const tokenData = GoogleTokenDataSchema.parse(await tokenResponse.json());

  // Fetch User Info from Google User Info endpoint and parse it into GoogleUserSchema
  const userInfoResponse = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    },
  );
  const userInfo = GoogleUserSchema.parse(await userInfoResponse.json());
  // Find user in db, if not found return forbidden
  const { email, picture } = userInfo;
  const user = await findUserByEmail(db, email);
  if (!user) {
    return c.json(
      {
        error: 'User not found in database',
      },
      401,
    );
  }

  void updateUserLastLogin(db, user.id);

  // Create cookie
  const tokenPayload = JWTPayloadSchema.parse({ ...user, picture });
  const token = await generateJWT(tokenPayload);

  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions());
  return c.json(tokenPayload, 200);
});

// Staging and development only, with a strong key (lib/login-bypass.ts): production never has the route.
const loginBypassKey = env.LOGIN_BYPASS_KEY;
if (isLoginBypassEnabled(env) && loginBypassKey) {
  loginRouter.openapi(loginBypassRoute, async (c) => {
    const { token, nim } = c.req.valid('query');

    if (!bypassTokenMatches(token, loginBypassKey)) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const user = await findUserByEmail(db, `${nim}@std.stei.itb.ac.id`);
    if (!user) {
      return c.json(
        {
          error:
            'User not found in database, please run seeder with the file from Google Drive',
        },
        401,
      );
    }
    const tokenPayload = JWTPayloadSchema.parse(user);
    const jwtToken = await generateJWT(tokenPayload);
    setCookie(c, SESSION_COOKIE, jwtToken, sessionCookieOptions());
    return c.json(tokenPayload, 200);
  });
}

loginProtectedRouter.openapi(logoutRoute, async (c) => {
  deleteCookie(c, SESSION_COOKIE);
  return c.json({}, 200);
});

loginProtectedRouter.openapi(selfRoute, async (c) => {
  const user = c.var.user;
  void updateUserLastLogin(db, user.id);
  const roles = await getUserRoles(db, user.id);
  return c.json({ ...user, roles }, 200);
});

loginProtectedRouter.openapi(getUserGroupsRoute, async (c) => {
  const user = c.var.user;
  const groups = await getUserGroups(db, user.id);
  return c.json(groups, 200);
});

const devLoginEmail = env.DEV_LOGIN_EMAIL;
const devLoginPasswordHash = env.DEV_LOGIN_PASSWORD_HASH;
if (isDevLoginEnabled(env) && devLoginEmail && devLoginPasswordHash) {
  loginRouter.openapi(devLoginRoute, async (c) => {
    const { email, password } = c.req.valid('json');
    const passwordMatches = verifyDevPassword(password, devLoginPasswordHash);
    if (
      email.toLowerCase() !== devLoginEmail.toLowerCase() ||
      !passwordMatches
    ) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Create only the configured test identity, after verifying its credentials.
    const user = await db.transaction(async (tx) => {
      await tx
        .insert(angkatan)
        .values({ year: 2025, name: '2025' })
        .onConflictDoNothing();
      await tx
        .insert(users)
        .values({
          nim: 'DEVTEST01',
          email: devLoginEmail.toLowerCase(),
          fullName: 'Development Tester',
          major: 'IF',
          region: 'Ganesha',
          angkatan: 2025,
          gender: 'M',
          membershipStatus: 'Anggota Biasa',
        })
        .onConflictDoNothing();
      return await findUserByEmail(tx, devLoginEmail.toLowerCase());
    });
    if (!user || user.nim !== 'DEVTEST01')
      return c.json({ error: 'Test account unavailable' }, 401);
    const payload = JWTPayloadSchema.parse(user);
    const secure =
      new URL(c.req.url).protocol === 'https:' ||
      c.req.header('x-forwarded-proto') === 'https';
    setCookie(c, 'hmif-app.access-cookie', await generateJWT(payload), {
      path: '/',
      secure,
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: parseInt(env.TOKEN_EXPIRATION),
    });
    await updateUserLastLogin(db, user.id);
    return c.json(payload, 200);
  });
}
