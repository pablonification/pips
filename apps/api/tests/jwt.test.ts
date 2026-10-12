import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Hono } from 'hono';
import { jwt, sign, verify } from 'hono/jwt';
import { JWT_ALG } from '../src/lib/jwt';

// Since Hono 4.10, jwt() and verify() need the algorithm. A mismatch with the one tokens are signed with
// would sign every member out, so these check the session cookie still round-trips.
const secret = 'test-secret';
const exp = Math.floor(Date.now() / 1000) + 60;

test('session tokens verify with the API’s algorithm', async () => {
  const token = await sign({ id: 'member', exp }, secret, JWT_ALG);
  assert.equal((await verify(token, secret, JWT_ALG)).id, 'member');
});

test('the auth middleware accepts the session cookie and rejects a missing one', async () => {
  const app = new Hono();
  app.use('/me', jwt({ secret, cookie: 'hmif-app.access-cookie', alg: JWT_ALG }));
  app.get('/me', (c) => c.json(c.get('jwtPayload')));

  const token = await sign({ id: 'member', exp }, secret, JWT_ALG);
  const ok = await app.request('/me', {
    headers: { Cookie: `hmif-app.access-cookie=${token}` },
  });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).id, 'member');

  assert.equal((await app.request('/me')).status, 401);
});
