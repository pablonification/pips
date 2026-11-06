import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { startServer } from './support/server';
import { sessionCookie, testUser } from './support/session';

// The real server, with a database that can't be reached (placeholder settings). Ports 4520–4529 (this task's).
const PORT = Number(process.env.API_RESILIENCE_TEST_PORT ?? 4522);

// Regression: `/api/me` updated the member's last sign-in in the background with nothing catching it. Node 22 ends
// the process on an unhandled rejection (unless Sentry, with a DSN, installed its own handler), so one failed
// database write took down the API and every socket.
test(
  'a failed background write is logged and the API keeps serving',
  { timeout: 60_000 },
  async (t) => {
    const server = await startServer(PORT);
    t.after(server.stop);
    const cookie = await sessionCookie(testUser('u-nadia'));

    const me = await fetch(`${server.base}/api/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(me.status, 500, 'the roles read fails without a database');

    // Give the background write time to fail (the connection is refused at once).
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(
      server.child.exitCode,
      null,
      `the API exited:\n${server.output()}`,
    );
    const after = await fetch(`${server.base}/`);
    assert.equal(after.status, 200);
    assert.match(server.output(), /Last sign-in update failed:/);
  },
);
