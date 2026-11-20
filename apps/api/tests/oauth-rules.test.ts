import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  bearerToken,
  cleanClientName,
  hashSecret,
  isAllowedRedirectUri,
  isOurResource,
  isS256Challenge,
  matchesRegisteredRedirect,
  newSecret,
  narrowScope,
  parseScope,
  redirectWith,
  scopeIncludes,
  verifyPkce,
} from '../src/lib/oauth';

const challengeOf = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

test('PKCE S256: only the verifier that made the challenge passes', () => {
  const verifier = 'v'.repeat(43);
  const challenge = challengeOf(verifier);
  assert.ok(isS256Challenge(challenge));
  assert.ok(verifyPkce(verifier, challenge));
  assert.ok(!verifyPkce('w'.repeat(43), challenge));
  // Too short for RFC 7636, even when it hashes right.
  assert.ok(!verifyPkce('short', challengeOf('short')));
  // A plain challenge (the verifier itself) is refused.
  assert.ok(!verifyPkce(verifier, verifier));
  assert.ok(!isS256Challenge('plain-value'));
});

test('redirect URIs: https anywhere, http only on the loopback address', () => {
  for (const ok of [
    'https://claude.ai/api/mcp/auth_callback',
    'http://127.0.0.1:33418/callback',
    'http://localhost:6274/oauth/callback',
    'http://[::1]:8080/cb',
    'https://example.com/cb?app=1',
  ])
    assert.ok(isAllowedRedirectUri(ok), ok);
  for (const bad of [
    'http://example.com/cb',
    'http://192.168.1.2/cb',
    'javascript:alert(1)',
    'data:text/html,hi',
    'https://example.com/cb#frag',
    'https://user:pass@example.com/cb',
    'myapp://callback',
    'not a url',
    `https://example.com/${'a'.repeat(2100)}`,
  ])
    assert.ok(!isAllowedRedirectUri(bad), bad);
});

test('a redirect URI must be registered exactly; a loopback one may change its port', () => {
  const registered = [
    'https://claude.ai/api/mcp/auth_callback',
    'http://127.0.0.1/callback',
  ];
  assert.ok(matchesRegisteredRedirect(registered[0], registered));
  assert.ok(
    !matchesRegisteredRedirect(
      'https://claude.ai/api/mcp/auth_callback/',
      registered,
    ),
  );
  assert.ok(!matchesRegisteredRedirect('https://claude.ai/other', registered));
  assert.ok(
    matchesRegisteredRedirect('http://127.0.0.1:51234/callback', registered),
  );
  assert.ok(
    !matchesRegisteredRedirect('http://127.0.0.1:51234/other', registered),
  );
  assert.ok(
    !matchesRegisteredRedirect('http://localhost:51234/callback', registered),
  );
});

test('a client name is plain text: no control or direction marks, spaces collapsed, length capped', () => {
  assert.equal(cleanClientName('  Claude \n  Code  '), 'Claude Code');
  assert.equal(cleanClientName('Evil\u202Eapp'), 'Evilapp');
  assert.equal(cleanClientName('a\u0000b\u200Bc'), 'abc');
  assert.equal(cleanClientName('x'.repeat(200)).length, 80);
  assert.equal(cleanClientName(42), '');
  assert.equal(cleanClientName('   '), '');
  // Markup is kept as text; the page never renders it as HTML.
  assert.equal(cleanClientName('<b>app</b>'), '<b>app</b>');
});

test('scopes: none means read; write brings read; an unknown one is refused', () => {
  assert.deepEqual(parseScope(undefined), ['pips.read']);
  assert.deepEqual(parseScope(''), ['pips.read']);
  assert.deepEqual(parseScope('pips.write'), ['pips.read', 'pips.write']);
  assert.deepEqual(parseScope('pips.write pips.read pips.read'), [
    'pips.read',
    'pips.write',
  ]);
  assert.equal(parseScope('pips.read admin'), undefined);
  assert.ok(scopeIncludes('pips.read pips.write', 'pips.write'));
  assert.ok(!scopeIncludes('pips.read', 'pips.write'));
});

test('the member may narrow the scopes to reading, never widen them; reading is always kept', () => {
  const both = 'pips.read pips.write';
  assert.equal(narrowScope(both, undefined), both);
  assert.equal(narrowScope(both, ['pips.read', 'pips.write']), both);
  assert.equal(narrowScope(both, ['pips.read']), 'pips.read');
  assert.equal(narrowScope(both, []), 'pips.read');
  assert.equal(narrowScope('pips.read', ['pips.read']), 'pips.read');
  // Widening, or a scope that doesn't exist, is refused.
  assert.equal(
    narrowScope('pips.read', ['pips.read', 'pips.write']),
    undefined,
  );
  assert.equal(narrowScope('pips.read', ['pips.write']), undefined);
  assert.equal(narrowScope(both, ['admin']), undefined);
});

test('resource: absent, or this server’s MCP endpoint', () => {
  const ours = 'https://app-api.hmif.dev/mcp';
  assert.ok(isOurResource(undefined, ours));
  assert.ok(isOurResource(ours, ours));
  assert.ok(isOurResource(`${ours}/`, ours));
  assert.ok(!isOurResource('https://evil.example/mcp', ours));
});

test('redirectWith keeps the client’s own query and adds the answer', () => {
  assert.equal(
    redirectWith('https://example.com/cb?app=1', {
      code: 'abc',
      state: 'xyz',
      skip: undefined,
    }),
    'https://example.com/cb?app=1&code=abc&state=xyz',
  );
});

test('secrets are random and stored only as their hash', () => {
  const a = newSecret('pips_at_');
  const b = newSecret('pips_at_');
  assert.notEqual(a, b);
  assert.ok(a.startsWith('pips_at_'));
  assert.ok(a.length > 40);
  assert.equal(hashSecret(a), hashSecret(a));
  assert.ok(!hashSecret(a).includes(a));
});

test('bearerToken reads only a well-formed Bearer header', () => {
  assert.equal(bearerToken('Bearer abc.def-_~'), 'abc.def-_~');
  assert.equal(bearerToken('bearer abc'), 'abc');
  assert.equal(bearerToken('Basic abc'), undefined);
  assert.equal(bearerToken('Bearer a b'), undefined);
  assert.equal(bearerToken(undefined), undefined);
});
