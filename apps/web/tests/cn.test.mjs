// F2-004: `cn` joins classes without tailwind-merge, so nothing may rely on a caller's utility replacing a
// component's own. Every `cn(…, className)` in src (a component taking the caller's classes) may give only its own
// Garis classes (`g-*`, the type utilities `t-*`, `disp`, `num`, `code`, `strong`) and plain state words, never a
// Tailwind utility a caller could want to override (the old `Saved` had `text-fg-2`; it now takes the caller's
// colour instead of its default).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { cn } from '../src/lib/utils.ts';

const src = path.resolve(import.meta.dirname, '../src');
const files = fs
  .readdirSync(src, { recursive: true })
  .map(String)
  .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('dev'));

/** The text of every `cn(...)` call in a source, parentheses balanced. */
function calls(text) {
  const out = [];
  for (const m of text.matchAll(/\bcn\(/g)) {
    let i = m.index + 3;
    let depth = 1;
    while (depth && i < text.length) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
      i++;
    }
    out.push(text.slice(m.index + 3, i - 1));
  }
  return out;
}

const OWN =
  /^(g-[\w-]+|t-[\w-]+|disp|num|code|strong|s\d+|glyph|sm|lg|round|full|wide|square|in-text|center|radio|dialog|urgent|me|them|unread|read|desk|many|draw|today|lap|gold|out|point|himpunan|akademik|past|z|block|sheet|default)$/;

test('cn joins and drops empty values, merging nothing', () => {
  assert.equal(cn('g-btn', false, 'gold', undefined, 'w-full'), 'g-btn gold w-full');
  assert.equal(cn('text-fg-2', 'text-fg-3'), 'text-fg-2 text-fg-3');
});

test('no component offers a Tailwind utility its caller could need to replace', () => {
  const problems = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(src, f), 'utf8');
    for (const call of calls(text)) {
      if (!/\bclassName\b/.test(call)) continue;
      // A default used only when the caller gives none (`className ?? 'text-fg-2'`) replaces nothing.
      const own = call.replace(/className\s*\?\?\s*'[^']*'/g, 'className');
      const tokens = [...own.matchAll(/'([^']*)'/g)].flatMap((m) =>
        m[1].split(/\s+/).filter(Boolean),
      );
      for (const t of tokens)
        if (!OWN.test(t)) problems.push(`${f}: ${t} in cn(${call.trim()})`);
    }
  }
  assert.deepEqual(problems, []);
});
