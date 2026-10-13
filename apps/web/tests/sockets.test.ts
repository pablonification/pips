import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// The API reads the session from the httpOnly cookie on the socket's handshake (apps/api/src/websocket/session.ts),
// and production's API is on another origin (app-api.hmif.dev), so a socket opened without `withCredentials`
// has no session: Curhat refuses to join or send, and Live Counting never joins its admin room.
const source = (file: string) =>
  fs.readFileSync(path.resolve(import.meta.dirname, '../src', file), 'utf8');

// Regression: today's Curhat opened its sockets without credentials, which only worked while the API trusted any
// room id a client sent.
for (const file of [
  // Today's screen, kept for Welfare until P3-C (P2-C moved it out of the route file).
  'routes/_app/_left-navbar/layanan/curhat/-components/welfare.tsx',
  // P2-C: the members' one connection for the Curhat area.
  'features/curhat/Area.tsx',
  'routes/_app/_left-navbar/kelola/live/$formId/-useFormAdminData.ts',
]) {
  test(`every socket in ${file} sends the session cookie`, () => {
    const calls = [...source(file).matchAll(/\bio\(([^)]*\{[\s\S]*?\})\s*\)/g)];
    assert.ok(calls.length > 0, 'no io() call found');
    for (const [call] of calls) {
      assert.match(call, /withCredentials:\s*true/, call);
    }
  });
}
