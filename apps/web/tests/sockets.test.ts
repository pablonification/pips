import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// The API reads the session from the httpOnly cookie on the socket's handshake (apps/api/src/websocket/session.ts),
// and production's API is on another origin (app-api.hmif.dev), so a socket opened without `withCredentials`
// has no session: Curhat refuses to join or send, and Live Counting never joins its admin room.
const source = (file: string) =>
  fs.readFileSync(path.resolve(import.meta.dirname, '../src', file), 'utf8');

// Curhat must open its sockets with credentials: without them it only works while the API trusts any
// room id a client sends.
for (const file of [
  // The one connection for the Curhat area; the Welfare inbox shares it (`kelola/curhat/route.tsx`).
  'features/curhat/Area.tsx',
  // Live Counting's admin room.
  'features/kelola/useFormLive.ts',
]) {
  test(`every socket in ${file} sends the session cookie`, () => {
    const calls = [...source(file).matchAll(/\bio\(([^)]*\{[\s\S]*?\})\s*\)/g)];
    assert.ok(calls.length > 0, 'no io() call found');
    for (const [call] of calls) {
      assert.match(call, /withCredentials:\s*true/, call);
    }
  });
}
