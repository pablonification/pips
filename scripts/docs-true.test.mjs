// Fails when the docs a newcomer's agent reads first have gone wrong: a link or a path that points at nothing, a
// command that names a script nobody has, an agent file that has grown too big, or a doc no index mentions.
// Every rule is a plain function tested on made-up text, then run once over the tracked files.
//
// Not checked on purpose: external links (CI has no network), and paths the docs write relative to somewhere this
// check cannot know (`lib/shell/routes.ts` inside a table about `apps/web/src`).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const AGENTS_BUDGET_BYTES = 8000;
const CLAUDE_FILE = '@AGENTS.md\n';

// Text shapes that are not a path to look up. Each is a real shape in the docs:
// - a glob or pattern (`*-darwin.png`, `0010-*`, `{a,b}`);
// - a placeholder (`<task>`, `…`) or a recipe's made-up example (`contoh`): the recipes build one that does not exist;
// - an address (`https://…`).
const NOT_A_PATH = /[*?{}<>…]|contoh|:\/\//;

const BUILTIN_PNPM = new Set([
  'add',
  'approve-builds',
  'audit',
  'bin',
  'config',
  'create',
  'dedupe',
  'deploy',
  'dlx',
  'doctor',
  'env',
  'exec',
  'fetch',
  'i',
  'import',
  'init',
  'install',
  'licenses',
  'link',
  'list',
  'ln',
  'ls',
  'outdated',
  'pack',
  'patch',
  'prune',
  'publish',
  'rebuild',
  'remove',
  'rm',
  'root',
  'self-update',
  'server',
  'setup',
  'store',
  'uninstall',
  'unlink',
  'up',
  'update',
  'why',
]);
const SHELL_FENCES = new Set(['bash', 'sh', 'shell', 'zsh', 'console']);

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const blank = (s) => s.replace(/[^\n]/g, ' ');

/** The text with fenced code blocks emptied (line numbers kept), and the fences as `{ lang, start, lines }`. */
export function splitFences(text) {
  const prose = [];
  const fences = [];
  let open = null;
  text.split('\n').forEach((raw, index) => {
    if (open) {
      const close = new RegExp(
        `^\\s*${open.mark[0]}{${open.mark.length},}\\s*$`,
      );
      if (close.test(raw)) open = null;
      else open.fence.lines.push({ line: index + 1, text: raw });
      prose.push('');
      return;
    }
    const start = /^\s*(`{3,}|~{3,})\s*([\w-]*)/.exec(raw);
    if (start) {
      const fence = {
        lang: start[2].toLowerCase(),
        start: index + 1,
        lines: [],
      };
      fences.push(fence);
      open = { mark: start[1], fence };
      prose.push('');
      return;
    }
    prose.push(raw);
  });
  return { prose: prose.join('\n'), fences };
}

const CODE_SPAN = /(`+)((?:(?!\n[ \t]*\n)[\s\S])+?)\1(?!`)/g;

/** Inline code spans outside fences: `[{ line, code }]`. */
export function inlineCode(text) {
  const { prose } = splitFences(text);
  return [...prose.matchAll(CODE_SPAN)].map((m) => ({
    line: lineOf(prose, m.index),
    code: m[2].replace(/\s*\n\s*/g, ' ').trim(),
  }));
}

/** The relative links in a document, leaving out fenced code and inline code: `[{ line, target }]`. */
export function linksIn(text) {
  const { prose } = splitFences(text);
  const masked = prose.replace(CODE_SPAN, (m) => blank(m));
  const found = [];
  for (const m of masked.matchAll(
    /!?\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
  ))
    found.push({ line: lineOf(masked, m.index), target: m[1] });
  for (const m of masked.matchAll(
    /^[ \t]{0,3}\[[^\]\n]+\]:\s*<?(\S+?)>?\s*$/gm,
  ))
    found.push({ line: lineOf(masked, m.index), target: m[1] });
  return found.filter(
    ({ target }) => !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(target),
  );
}

/** GitHub's rule for turning a heading's text into an anchor. */
export function githubAnchor(heading) {
  return heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '')
    .replace(/ /g, '-');
}

/** Every anchor a document offers; repeated headings get `-1`, `-2` as GitHub does. */
export function anchorsOf(text) {
  const { prose } = splitFences(text);
  const seen = new Map();
  const anchors = new Set();
  for (const m of prose.matchAll(
    /^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/gm,
  )) {
    const base = githubAnchor(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

/**
 * Dead relative links in one document. `tracked` is the set of tracked files and folders; `textOf(path)` reads a
 * tracked Markdown file.
 */
export function deadLinks(file, text, tracked, textOf) {
  const problems = [];
  for (const { line, target } of linksIn(text)) {
    const [pathPart, ...rest] = target.split('#');
    const anchor = rest.join('#');
    const where = `${file}:${line}`;
    let resolved = file;
    if (pathPart !== '') {
      let decoded = pathPart.split('?')[0];
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        // keep the text as written
      }
      resolved = posix
        .normalize(posix.join(posix.dirname(file), decoded))
        .replace(/\/$/, '');
      if (!tracked.has(resolved)) {
        problems.push(
          `${where}: the link "${target}" points at ${resolved}, which is not tracked. Fix the path or remove the link.`,
        );
        continue;
      }
    }
    if (anchor && resolved.endsWith('.md') && tracked.has(resolved)) {
      const wanted = decodeURIComponent(anchor).toLowerCase();
      if (!anchorsOf(textOf(resolved)).has(wanted))
        problems.push(
          `${where}: the link "${target}" needs a heading that becomes #${wanted} in ${resolved}, and there is none. Fix the anchor or the heading.`,
        );
    }
  }
  return problems;
}

const topLevelNames = (tracked) =>
  new Set([...tracked].filter((p) => !p.includes('/')));

/**
 * Backticked repository paths that point at nothing: `[{ line, token }]`. A token counts as a path when it is
 * one word, has a `/` and a file extension (or ends in `/`), and starts with a name that exists beside the
 * document, in its app, or at the root. Anything git ignores on purpose (`isIgnored`) or that is a glob, a
 * placeholder or an address (NOT_A_PATH) is left out.
 */
export function deadPaths(file, text, tracked, isIgnored = () => false) {
  const app = /^apps\/[^/]+/.exec(file)?.[0];
  const bases = [
    ...new Set(
      ['', app, posix.dirname(file) === '.' ? '' : posix.dirname(file)].filter(
        (b) => b !== undefined,
      ),
    ),
  ];
  const firsts = (base) => {
    const names = new Set();
    for (const p of tracked) {
      if (base && !p.startsWith(`${base}/`)) continue;
      const rest = base ? p.slice(base.length + 1) : p;
      names.add(rest.split('/')[0]);
    }
    return names;
  };
  const known = bases.map((b) => ({ base: b, names: firsts(b) }));
  const problems = [];
  for (const { line, code } of inlineCode(text)) {
    if (/\s/.test(code) || NOT_A_PATH.test(code)) continue;
    const token = code.replace(/:\d+(?:-\d+)?$/, '');
    if (!(token.endsWith('/') || /\/[^/]*\.[A-Za-z0-9]+$/.test(token)))
      continue;
    const clean = token.replace(/^\.\//, '');
    const first = clean.split('/')[0];
    const candidates = known
      .filter((k) => k.names.has(first))
      .map((k) =>
        posix.normalize(posix.join(k.base, clean)).replace(/\/$/, ''),
      );
    if (candidates.length === 0) continue;
    if (candidates.some((c) => tracked.has(c))) continue;
    if (candidates.some((c) => isIgnored(c))) continue;
    problems.push({ line, token, tried: candidates });
  }
  return problems.map(
    (p) =>
      `${file}:${p.line}: \`${p.token}\` is not a tracked file or folder (looked for ${p.tried.join(', ')}). Fix the path.`,
  );
}

/** The `pnpm` commands in a document, from shell fences and inline code: `[{ line, tokens }]`. */
export function pnpmCommands(text) {
  const { prose, fences } = splitFences(text);
  const sources = [];
  for (const fence of fences) {
    if (!SHELL_FENCES.has(fence.lang)) continue;
    let joined = null;
    for (const { line, text: raw } of fence.lines) {
      const piece = raw.replace(/\\\s*$/, '');
      joined = joined
        ? { line: joined.line, text: `${joined.text} ${piece.trim()}` }
        : { line, text: piece };
      if (!/\\\s*$/.test(raw)) {
        sources.push(joined);
        joined = null;
      }
    }
    if (joined) sources.push(joined);
  }
  for (const m of prose.matchAll(CODE_SPAN))
    sources.push({
      line: lineOf(prose, m.index),
      text: m[2].replace(/\s*\n\s*/g, ' '),
    });

  const commands = [];
  for (const { line, text: source } of sources) {
    for (const segment of source
      .replace(/(^|\s)#.*$/, '')
      .split(/&&|\|\||;|\|/)) {
      let tokens = segment
        .trim()
        .replace(/^\$\s+/, '')
        .split(/\s+/)
        .filter(Boolean);
      while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]))
        tokens = tokens.slice(1);
      if (tokens[0] === 'pnpm') commands.push({ line, tokens });
    }
  }
  return commands;
}

/** The packages a `pnpm` command can reach: `{ dir, scripts }` by name, with the root as `''`. */
export function packagesFrom(readJson, paths) {
  const packages = new Map();
  for (const path of paths) {
    const json = readJson(path);
    const dir = posix.dirname(path) === '.' ? '' : posix.dirname(path);
    packages.set(dir === '' ? '' : json.name, {
      dir,
      scripts: new Set(Object.keys(json.scripts ?? {})),
      name: json.name,
    });
  }
  return packages;
}

/**
 * Commands that name a script nobody has, or a Playwright config that is not there. A command without `--filter`
 * runs from the repository root, or from the app whose README it is in.
 */
export function deadCommands(file, text, packages, tracked) {
  const problems = [];
  const app = /^apps\/[^/]+/.exec(file)?.[0];
  const byDir = new Map([...packages.values()].map((p) => [p.dir, p]));
  const byName = new Map(
    [...packages.values()].filter((p) => p.dir !== '').map((p) => [p.name, p]),
  );
  for (const { line, tokens } of pnpmCommands(text)) {
    const where = `${file}:${line}`;
    const filters = [];
    let i = 1;
    while (i < tokens.length && tokens[i].startsWith('-')) {
      const t = tokens[i];
      if (t === '--filter' || t === '-F' || t === '--dir' || t === '-C') {
        filters.push(tokens[i + 1]);
        i += 2;
      } else if (t.startsWith('--filter=')) {
        filters.push(t.slice('--filter='.length));
        i += 1;
      } else i += 1;
    }
    const command = tokens[i];
    if (
      !command ||
      [...filters, command].some((t) => t === undefined || /[<>$]/.test(t))
    )
      continue;

    let scopes;
    if (filters.length === 0)
      scopes = [byDir.get(''), app ? byDir.get(app) : undefined].filter(
        Boolean,
      );
    else {
      scopes = filters.map(
        (f) => byName.get(f) ?? byDir.get(f.replace(/^\.\//, '')),
      );
      const unknown = filters.find((f, k) => !scopes[k]);
      if (unknown !== undefined) {
        problems.push(
          `${where}: \`${tokens.join(' ')}\` filters on "${unknown}", which is no package here (${[...byName.keys()].join(', ')}). Fix the filter.`,
        );
        continue;
      }
    }

    if (command === 'exec' || command === 'dlx') {
      const rest = tokens.slice(i + 1);
      const at = rest.findIndex(
        (t) => t === '-c' || t === '--config' || t.startsWith('--config='),
      );
      if (command === 'exec' && at !== -1) {
        const value = rest[at].startsWith('--config=')
          ? rest[at].slice('--config='.length)
          : rest[at + 1];
        if (value && !/[<>$*]/.test(value)) {
          const dirs = scopes.map((s) => s.dir);
          const found = dirs.some((d) =>
            tracked.has(
              posix.normalize(posix.join(d, value)).replace(/^\.$/, ''),
            ),
          );
          if (!found)
            problems.push(
              `${where}: \`${tokens.join(' ')}\` names the config "${value}", which is not tracked in ${dirs.map((d) => d || 'the root').join(' or ')}. Fix the path.`,
            );
        }
      }
      continue;
    }
    if (BUILTIN_PNPM.has(command)) continue;
    const script =
      command === 'run' || command === 'run-script' ? tokens[i + 1] : command;
    if (!script || /[<>$]/.test(script) || script.startsWith('-')) continue;
    if (!scopes.some((s) => s.scripts.has(script))) {
      const where2 = scopes.map((s) => s.dir || 'the root').join(' or ');
      problems.push(
        `${where}: \`${tokens.join(' ')}\` runs the script "${script}", and ${where2}'s package.json has none by that name. Fix the command or add the script.`,
      );
    }
  }
  return problems;
}

/** The agent file's size and `CLAUDE.md`'s exact content. Both load into every agent on every task. */
export function agentFileProblems(agents, claude) {
  const problems = [];
  const bytes = Buffer.byteLength(agents);
  if (bytes >= AGENTS_BUDGET_BYTES)
    problems.push(
      `AGENTS.md is ${bytes} bytes and the budget is under ${AGENTS_BUDGET_BYTES}. Every agent loads it on every task, so move detail into docs/ and link it.`,
    );
  if (claude !== CLAUDE_FILE)
    problems.push(
      `CLAUDE.md must be exactly "@AGENTS.md" and a newline, so every agent reads one file. Put anything else in AGENTS.md.`,
    );
  return problems;
}

/** Files an index forgets: ADRs missing from the ADR index, and other docs missing from docs/README.md. */
export function unindexed(tracked, linkTargetsOf) {
  const resolved = (index) =>
    new Set(
      linksIn(linkTargetsOf(index)).map(({ target }) =>
        posix.normalize(posix.join(posix.dirname(index), target.split('#')[0])),
      ),
    );
  const docs = [...tracked].filter(
    (p) => p.startsWith('docs/') && tracked.has(p) && /\.[A-Za-z0-9]+$/.test(p),
  );
  const problems = [];
  const adrLinked = resolved('docs/adr/README.md');
  for (const p of docs.filter(
    (p) => p.startsWith('docs/adr/') && p !== 'docs/adr/README.md',
  ))
    if (!adrLinked.has(p))
      problems.push(
        `${p} is not listed in docs/adr/README.md. Add a row for it.`,
      );
  const docsLinked = resolved('docs/README.md');
  for (const p of docs.filter(
    (p) => !p.startsWith('docs/adr/') || p === 'docs/adr/README.md',
  ))
    if (p !== 'docs/README.md' && !docsLinked.has(p))
      problems.push(
        `${p} is not linked from docs/README.md. Add it to the table or the list there.`,
      );
  return problems;
}

// ---- The real repository -------------------------------------------------------------------------------------

const git = (args, input) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    input,
  });
const trackedList = () => git(['ls-files', '-z']).split('\0').filter(Boolean);
const withFolders = (files) => {
  const all = new Set(files);
  for (const f of files)
    for (let d = posix.dirname(f); d !== '.'; d = posix.dirname(d)) all.add(d);
  return all;
};
const read = (path) => readFileSync(join(root, path), 'utf8');
const isDoc = (p) =>
  /^(AGENTS|CLAUDE|CONTEXT|README|CONTRIBUTING|SECURITY|DEPLOY)\.md$/.test(p) ||
  /^docs\/.+\.md$/.test(p) ||
  /^apps\/[^/]+\/README\.md$/.test(p) ||
  p === 'apps/web/e2e/README.md' ||
  /^\.github\/[^/]+\.md$/.test(p);
// Git ignores some paths on purpose (a build folder, `.env`). A pattern such as `.build/` only matches a folder, and a
// path that does not exist cannot say which it is, so both spellings are asked about. Only dead candidates are asked.
const asked = new Map();
const gitIgnores = (path) => {
  if (!asked.has(path)) {
    const ask = (p) => {
      try {
        git(['check-ignore', '-q', p]);
        return true;
      } catch {
        return false;
      }
    };
    asked.set(path, ask(path) || ask(`${path}/`));
  }
  return asked.get(path);
};

const files = trackedList();
const tracked = withFolders(files);
const docs = files.filter(isDoc);

const heading = (problems) => problems.join('\n');

test('every relative link in the docs points at a tracked file, and every anchor at a heading', () => {
  const problems = docs.flatMap((d) => deadLinks(d, read(d), tracked, read));
  assert.deepEqual(
    problems,
    [],
    `Dead links in the docs:\n${heading(problems)}`,
  );
});

test('every path written in backticks in the docs is a tracked file or folder', () => {
  const problems = docs.flatMap((d) =>
    deadPaths(d, read(d), tracked, gitIgnores),
  );
  assert.deepEqual(
    problems,
    [],
    `Dead paths in the docs:\n${heading(problems)}`,
  );
});

test('every pnpm command in the docs names a script that exists', () => {
  const packages = packagesFrom(
    (p) => JSON.parse(read(p)),
    files.filter(
      (p) => p === 'package.json' || /^apps\/[^/]+\/package\.json$/.test(p),
    ),
  );
  const problems = docs.flatMap((d) =>
    deadCommands(d, read(d), packages, tracked),
  );
  assert.deepEqual(
    problems,
    [],
    `Dead commands in the docs:\n${heading(problems)}`,
  );
});

test('the agent file stays small and CLAUDE.md only points at it', () => {
  const problems = agentFileProblems(read('AGENTS.md'), read('CLAUDE.md'));
  assert.deepEqual(problems, [], heading(problems));
});

test('the docs indexes list every file they should', () => {
  const problems = unindexed(tracked, read);
  assert.deepEqual(
    problems,
    [],
    `Docs missing from an index:\n${heading(problems)}`,
  );
});

// ---- The rules, on made-up text ------------------------------------------------------------------------------

const FENCE = '```';
const set = (...paths) => withFolders(paths);

test('a fenced block and inline code are left out when looking for links', () => {
  const text = [
    'See [a](a.md).',
    '',
    FENCE + 'md',
    '[b](b.md)',
    FENCE,
    '',
    'Write `[c](c.md)` like that.',
  ].join('\n');
  assert.deepEqual(linksIn(text), [{ line: 1, target: 'a.md' }]);
});

test('external links and mail links are not looked up', () => {
  assert.deepEqual(
    linksIn(
      '[x](https://example.com/a) [y](mailto:a@example.com) [z](#top)',
    ).map((l) => l.target),
    ['#top'],
  );
});

test('a dead link is caught with its file and line, and a live one passes', () => {
  const text =
    'Intro\n\n[gone](docs/gone.md) and [here](docs/here.md) and [folder](nodocs/)';
  const problems = deadLinks(
    'README.md',
    text,
    set('README.md', 'docs/here.md'),
    () => '',
  );
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^README\.md:3: .*docs\/gone\.md.*not tracked/);
  assert.match(problems[1], /nodocs\//);
  assert.deepEqual(
    deadLinks('README.md', '[f](docs/)', set('docs/here.md'), () => ''),
    [],
  );
});

test('a link is resolved from the folder of the file that holds it', () => {
  const tracked = set('docs/adr/0001-x.md', 'CONTEXT.md');
  assert.deepEqual(
    deadLinks(
      'docs/adr/README.md',
      '[a](0001-x.md) [c](../../CONTEXT.md)',
      tracked,
      () => '',
    ),
    [],
  );
  assert.equal(
    deadLinks('docs/adr/README.md', '[c](../CONTEXT.md)', tracked, () => '')
      .length,
    1,
  );
});

test('an anchor must match a heading, by the rule GitHub uses', () => {
  assert.equal(githubAnchor('First run (with `.env`)'), 'first-run-with-env');
  assert.equal(githubAnchor('Ways to hurt yourself'), 'ways-to-hurt-yourself');
  const target =
    '# Title\n\n## First run\n\n## First run\n\n' +
    FENCE +
    '\n## Not a heading\n' +
    FENCE +
    '\n';
  assert.deepEqual(
    [...anchorsOf(target)],
    ['title', 'first-run', 'first-run-1'],
  );
  const tracked = set('A.md', 'B.md');
  const textOf = () => target;
  assert.deepEqual(
    deadLinks('A.md', '[ok](B.md#first-run-1) [same](#x)', tracked, textOf)
      .length,
    1,
  );
  const bad = deadLinks('A.md', '[no](B.md#not-a-heading)', tracked, textOf);
  assert.match(bad[0], /^A\.md:1: .*#not-a-heading in B\.md/);
});

test('a dead path in backticks is caught, and a live one passes', () => {
  const tracked = set('apps/web/src/a.ts', 'docs/x.md');
  const text = 'Use `apps/web/src/a.ts` and `apps/web/src/b.ts` and `docs/`.';
  const problems = deadPaths('AGENTS.md', text, tracked);
  assert.equal(problems.length, 1);
  assert.match(
    problems[0],
    /^AGENTS\.md:1: `apps\/web\/src\/b\.ts` is not a tracked file/,
  );
});

test('a path whose first folder is unknown is not judged', () => {
  assert.deepEqual(
    deadPaths(
      'AGENTS.md',
      'In `lib/shell/routes.ts` and `elsewhere/x.md`.',
      set('apps/web/a.ts'),
    ),
    [],
  );
});

test('a path in an app README may be relative to the app', () => {
  const tracked = set('apps/web/src/a.ts', 'apps/web/README.md');
  assert.deepEqual(
    deadPaths(
      'apps/web/README.md',
      '`src/a.ts` and `apps/web/src/a.ts`',
      tracked,
    ),
    [],
  );
  assert.equal(
    deadPaths('apps/web/README.md', '`src/b.ts`', tracked).length,
    1,
  );
});

test('a path git ignores on purpose passes', () => {
  const tracked = set('apps/api/src/a.ts');
  const text = 'Copy `apps/api/.env.example` to `apps/api/.env`.';
  assert.equal(deadPaths('AGENTS.md', text, tracked).length, 2);
  const ignored = (p) => p === 'apps/api/.env';
  const problems = deadPaths('AGENTS.md', text, tracked, ignored);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /\.env\.example/);
});

test('globs, placeholders, recipe examples and addresses are not looked up', () => {
  const tracked = set('apps/web/e2e/a.ts', 'docs/x.md');
  const text = [
    '`apps/web/e2e/*-darwin.png`',
    '`docs/adr/0010-*`',
    '`apps/web/src/features/<name>/`',
    '`apps/web/src/features/contoh/Contoh.tsx`',
    '`https://example.com/apps/x.md`',
    '`apps/web/{a,b}.ts`',
  ].join('\n');
  assert.deepEqual(deadPaths('docs/README.md', text, tracked), []);
});

test('only one-word tokens with an extension or a trailing slash count as paths', () => {
  const tracked = set('apps/web/a.ts');
  assert.deepEqual(
    deadPaths(
      'AGENTS.md',
      '`apps/web` and `apps/web/missing` and `apps run/x.ts`',
      tracked,
    ),
    [],
  );
  assert.equal(
    deadPaths('AGENTS.md', '`apps/web/missing/`', tracked).length,
    1,
  );
  assert.equal(
    deadPaths('AGENTS.md', '`apps/web/a.ts:12` `apps/web/b.ts:12-20`', tracked)
      .length,
    1,
  );
});

const packages = packagesFrom(
  (p) =>
    ({
      'package.json': {
        name: 'pips',
        scripts: { build: '', check: '', test: '' },
      },
      'apps/web/package.json': {
        name: 'web',
        scripts: { dev: '', api: '', e2e: '' },
      },
      'apps/api/package.json': {
        name: 'api',
        scripts: { dev: '', 'test:db': '' },
      },
    })[p],
  ['package.json', 'apps/web/package.json', 'apps/api/package.json'],
);
const cmdTracked = set(
  'apps/web/e2e/playwright.config.ts',
  'apps/web/package.json',
);

test('commands are found in shell fences and inline code, not in other fences', () => {
  const text = [
    FENCE + 'bash',
    '$ pnpm check && pnpm test   # both',
    'pnpm --filter web \\',
    '  dev',
    FENCE,
    FENCE + 'yaml',
    'run: pnpm nothing',
    FENCE,
    'Run `pnpm build` or `pnpm --filter api test:db`.',
  ].join('\n');
  assert.deepEqual(
    pnpmCommands(text).map((c) => [c.line, c.tokens.join(' ')]),
    [
      [2, 'pnpm check'],
      [2, 'pnpm test'],
      [3, 'pnpm --filter web dev'],
      [9, 'pnpm build'],
      [9, 'pnpm --filter api test:db'],
    ],
  );
});

test('a script that exists passes, in the root and behind --filter', () => {
  const text =
    '`pnpm check` `pnpm --filter web dev` `pnpm --filter api test:db` `pnpm run build` `pnpm -F web api`';
  assert.deepEqual(deadCommands('AGENTS.md', text, packages, cmdTracked), []);
});

test('a misspelled script is caught with the file, the line and the package it looked in', () => {
  const problems = deadCommands(
    'AGENTS.md',
    'x\n\n`pnpm --filter web devv` and `pnpm lint`',
    packages,
    cmdTracked,
  );
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^AGENTS\.md:3: .*"devv".*apps\/web/);
  assert.match(problems[1], /"lint".*the root/);
});

test('a filter that names no package is caught', () => {
  const problems = deadCommands(
    'AGENTS.md',
    '`pnpm --filter site build`',
    packages,
    cmdTracked,
  );
  assert.match(problems[0], /filters on "site", which is no package here/);
});

test('built-in pnpm commands and placeholders are not scripts', () => {
  const text =
    '`pnpm install` `pnpm --filter web exec vite` `pnpm dlx x` `pnpm <script>` `pnpm --filter <app> dev`';
  assert.deepEqual(deadCommands('AGENTS.md', text, packages, cmdTracked), []);
});

test('a command without a filter in an app README may use that app’s scripts', () => {
  assert.deepEqual(
    deadCommands('apps/web/README.md', '`pnpm dev`', packages, cmdTracked),
    [],
  );
  assert.equal(
    deadCommands('README.md', '`pnpm dev`', packages, cmdTracked).length,
    1,
  );
});

test('a Playwright config named in a command must exist', () => {
  const ok =
    '`pnpm --filter web exec playwright test -c e2e/playwright.config.ts`';
  assert.deepEqual(deadCommands('AGENTS.md', ok, packages, cmdTracked), []);
  const bad = deadCommands(
    'AGENTS.md',
    '`pnpm --filter web exec playwright test -c e2e/other.config.ts`',
    packages,
    cmdTracked,
  );
  assert.match(bad[0], /names the config "e2e\/other\.config\.ts"/);
});

test('an agent file at or over the budget, or a CLAUDE.md with more in it, is refused', () => {
  assert.deepEqual(agentFileProblems('x'.repeat(7999), '@AGENTS.md\n'), []);
  const long = agentFileProblems('x'.repeat(8000), '@AGENTS.md\n');
  assert.match(long[0], /AGENTS\.md is 8000 bytes.*loads it on every task/);
  assert.equal(agentFileProblems('x', '@AGENTS.md').length, 1);
  assert.equal(agentFileProblems('x', '@AGENTS.md\nmore\n').length, 1);
});

test('an ADR missing from the ADR index, and a doc missing from docs/README.md, are caught', () => {
  const tracked = set(
    'docs/README.md',
    'docs/adr/README.md',
    'docs/adr/0001-a.md',
    'docs/adr/0002-b.md',
    'docs/guide.md',
    'docs/more.md',
  );
  const texts = {
    'docs/adr/README.md': '| [1](0001-a.md) |',
    'docs/README.md': '[guide](guide.md) [adr](adr/README.md)',
  };
  const problems = unindexed(tracked, (p) => texts[p]);
  assert.deepEqual(problems, [
    'docs/adr/0002-b.md is not listed in docs/adr/README.md. Add a row for it.',
    'docs/more.md is not linked from docs/README.md. Add it to the table or the list there.',
  ]);
});

test('a complete index passes', () => {
  const tracked = set(
    'docs/README.md',
    'docs/adr/README.md',
    'docs/adr/0001-a.md',
    'docs/x/y.md',
  );
  const texts = {
    'docs/adr/README.md': '[1](0001-a.md#top)',
    'docs/README.md': '[adr](adr/README.md) [y](x/y.md)',
  };
  assert.deepEqual(
    unindexed(tracked, (p) => texts[p]),
    [],
  );
});
