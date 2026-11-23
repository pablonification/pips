import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { appName } from '../src/features/aplikasi/name';
import { appLine, appMark, mcpAddress } from '../src/features/aplikasi/rules';

const NOW = Date.parse('2026-10-08T06:35:00Z'); // Kamis 8 Oktober 2026, 13.35 WIB

test('an app with no name is shown with a fixed one; a name is shown as given', () => {
  assert.equal(appName('Claude'), 'Claude');
  assert.equal(appName('  '), 'Aplikasi tanpa nama');
  assert.equal(appName('<b>App</b>'), '<b>App</b>');
});

test("a connected app's line says what it may do, when it was connected and last used", () => {
  assert.equal(
    appLine(
      {
        connectedAt: '2026-10-08T06:15:00Z',
        lastUsedAt: '2026-10-08T06:25:00Z',
        scopes: ['pips.read', 'pips.write'],
      },
      NOW,
    ),
    'Baca dan ubah · Terhubung 20 menit lalu · Terakhir dipakai 10 menit lalu',
  );
  assert.equal(
    appLine(
      {
        connectedAt: '2026-10-07T06:00:00Z',
        lastUsedAt: null,
        scopes: ['pips.read'],
      },
      NOW,
    ),
    'Hanya baca · Terhubung kemarin · Belum dipakai',
  );
});

test('the MCP address is the API’s own, or this site’s when the API shares it', () => {
  assert.equal(
    mcpAddress('https://app-api.hmif.dev', 'https://app.hmif.dev'),
    'https://app-api.hmif.dev/mcp',
  );
  assert.equal(
    mcpAddress('https://app-api.hmif.dev/', 'https://app.hmif.dev'),
    'https://app-api.hmif.dev/mcp',
  );
  assert.equal(
    mcpAddress('', 'http://localhost:5173'),
    'http://localhost:5173/mcp',
  );
  assert.equal(
    mcpAddress(undefined, 'http://localhost:5173'),
    'http://localhost:5173/mcp',
  );
});

test('a connected app shows its mark only by the host its sign-ins return to, never by its name', () => {
  assert.equal(appMark('claude.ai'), 'claude');
  assert.equal(appMark('chatgpt.com'), 'chatgpt');
  assert.equal(appMark('chat.openai.com'), 'chatgpt');
  // A look-alike host, a sub-domain, or no single host (the API's null) keeps the link icon.
  assert.equal(appMark('claude.ai.example.com'), null);
  assert.equal(appMark('evil.claude.ai'), null);
  assert.equal(appMark(null), null);
  assert.equal(appMark(undefined), null);
});
