import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headerProblem, MAX_HEADER } from './commit-messages.mjs';

test('accepts Conventional Commits headers', () => {
  for (const header of [
    'feat(web): add the Kalender month view',
    'fix(api)!: refuse answers to a closed form with 403',
    'test(e2e): cover Back from a course page',
    'chore(merge): P0-C app shell into redesign (#6)',
    'docs: explain the fidelity mapping',
    'build(deps,web): update vite',
  ]) {
    assert.equal(headerProblem(header), null, header);
  }
});

test('refuses anything else', () => {
  for (const header of [
    'Add the Kalender month view',
    "Merge branch 'redesign' into rd/p1-a-beranda",
    'feat(Web): a capital scope',
    'feature(web): an unknown type',
    'feat: ',
    'feat(web):no space',
  ]) {
    assert.notEqual(headerProblem(header), null, header);
  }
});

test(`refuses a header longer than ${MAX_HEADER} characters`, () => {
  assert.match(headerProblem(`feat(web): ${'a'.repeat(MAX_HEADER)}`), /longer/);
});
