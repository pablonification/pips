import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { headerProblem, MAX_HEADER, MAX_TITLE, titleProblem } from './commit-messages.mjs';

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

test('accepts a pull request title that is a Conventional Commit', () => {
  for (const title of [
    'feat(web): add the Kalender month view',
    'fix(api)!: refuse answers to a closed form with 403',
    'docs: explain the fidelity mapping',
    `fix(web): ${'a'.repeat(MAX_TITLE - 'fix(web): '.length)}`,
  ]) {
    assert.equal(titleProblem(title), null, title);
  }
});

test('refuses a pull request title that is not a Conventional Commit', () => {
  for (const title of ['Add the Kalender month view', 'Fix stuff', 'feat: ', '']) {
    assert.match(titleProblem(title), /type\(scope\): summary/, title);
  }
});

test(`refuses a title over ${MAX_TITLE} characters, so the squash commit with its (#123) stays within ${MAX_HEADER}`, () => {
  const title = `fix(web): ${'a'.repeat(MAX_TITLE - 'fix(web): '.length + 1)}`;
  assert.match(titleProblem(title), /longer than 94/);
  assert.ok(`${title} (#123)`.length > MAX_HEADER);
});

test('the command line refuses a bad title and accepts a good one', () => {
  const run = (title) => {
    try {
      execFileSync('node', ['scripts/commit-messages.mjs', 'HEAD', 'HEAD'], {
        env: { ...process.env, PR_TITLE: title },
        stdio: 'pipe',
      });
      return 0;
    } catch (error) {
      return error.status;
    }
  };
  assert.equal(run('fix(web): a good title'), 0);
  assert.equal(run('a bad title'), 1);
});
