// Open questions and decisions for the review package (F1 brief, step 10): pulls every item from the sections of
// Markdown files that name them ("Open questions", "Deviations", "Needs Dev 1", "New copy", "New strings",
// "Choices to check", "… for the owner", "Still open"), at any heading level or as a bold lead-in, plus
// OPEN-QUESTIONS.md's tables and PLAN.md's logged decisions. Duplicates are merged, keeping every source; nothing is
// answered or dropped. Unit-tested in tests/review-questions.test.mjs.

/** A section title that holds items, and what kind of item it holds. @type {[RegExp, string][]} */
export const KINDS = [
  [/new copy|new strings/i, 'new-copy'],
  [/needs dev 1/i, 'needs-dev1'],
  [/choices to check/i, 'choice'],
  [/deviation/i, 'deviation'],
  [
    /open questions|questions still open|still open|questions for the owner/i,
    'open-question',
  ],
  [/for the owner/i, 'for-owner'],
];

/** @param {string} title */
export function kindOf(title) {
  for (const [re, kind] of KINDS) if (re.test(title)) return kind;
  return null;
}

const LIST = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
/** A bold lead-in: "**Title**", "**Title:**", "**Title** (…):" at the start of a paragraph or list item. */
const LEAD = /^\*\*([^*]+?)\*\*/;

/** Markdown to plain text for comparing and showing: no emphasis, code ticks or link targets. @param {string} s */
export const plain = (s) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The key two items are the same by: lower case, letters and digits only. @param {string} s */
export const keyOf = (s) =>
  plain(s)
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/g, ' ')
    .trim();

/**
 * Every item in the file's question-holding sections.
 * @param {string} md @param {string} file
 * @returns {{ kind: string, text: string, source: { file: string, section: string, line: number } }[]}
 */
export function extractItems(md, file) {
  const lines = md.split('\n');
  /** @type {{ kind: string, text: string, source: { file: string, section: string, line: number } }[]} */
  const out = [];
  /** @type {{ level: number, kind: string | null, title: string }} */
  let heading = { level: 0, kind: null, title: '' };
  /** A bold lead-in paragraph's kind, until the next heading or bold lead-in. */
  let lead = /** @type {{ kind: string | null, title: string } | null} */ (
    null
  );
  /** Open list items: indent, the kind their children take (a bold lead-in item), and the item being built. */
  /** @type {{ indent: number, childKind: string | null, title: string, item: { kind: string, text: string, source: { file: string, section: string, line: number } } | null }[]} */
  let stack = [];
  let inFence = false;

  /** @returns {{ kind: string, title: string } | null} */
  const contextKind = () => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const k = stack[i].childKind;
      if (k) return { kind: k, title: stack[i].title };
    }
    if (lead?.kind) return { kind: lead.kind, title: lead.title };
    return heading.kind ? { kind: heading.kind, title: heading.title } : null;
  };

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h = HEADING.exec(line);
    if (h) {
      heading = { level: h[1].length, kind: kindOf(h[2]), title: plain(h[2]) };
      lead = null;
      stack = [];
      continue;
    }
    const li = LIST.exec(line);
    if (li) {
      const indent = li[1].length;
      const body = li[2];
      while (stack.length && stack[stack.length - 1].indent >= indent)
        stack.pop();
      const leadIn = LEAD.exec(body);
      const leadKind = leadIn ? kindOf(leadIn[1]) : null;
      const ctx = contextKind();
      // A child of an ordinary item: part of that item's text.
      const parent = stack[stack.length - 1];
      if (parent && !parent.childKind && parent.item) {
        parent.item.text += `; ${plain(body)}`;
        stack.push({ indent, childKind: null, title: '', item: null });
        continue;
      }
      if (leadIn && leadKind) {
        // "- **New copy:**" with the strings under it: its children are the items. With nothing under it, itself.
        const item = {
          kind: leadKind,
          text: plain(body),
          source: { file, section: plain(leadIn[1]), line: n + 1 },
        };
        const hasChildren =
          (LIST.exec(lines[n + 1] ?? '')?.[1].length ?? -1) > indent;
        if (!hasChildren) out.push(item);
        stack.push({
          indent,
          childKind: leadKind,
          title: plain(leadIn[1]),
          item: hasChildren ? null : item,
        });
        continue;
      }
      if (!ctx) {
        stack.push({ indent, childKind: null, title: '', item: null });
        continue;
      }
      const item = {
        kind: ctx.kind,
        text: plain(body),
        source: { file, section: ctx.title, line: n + 1 },
      };
      out.push(item);
      stack.push({ indent, childKind: null, title: '', item });
      continue;
    }
    if (/^\|/.test(line.trim())) {
      const ctx = contextKind();
      const cells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => plain(c));
      const next = lines[n + 1] ?? '';
      const isHeader = /^\s*\|?\s*:?-{3,}/.test(next);
      const isRule = cells.every((c) => /^:?-{3,}:?$/.test(c));
      if (ctx && !isHeader && !isRule && cells.some(Boolean))
        out.push({
          kind: ctx.kind,
          text: cells.filter(Boolean).join(' · '),
          source: { file, section: ctx.title, line: n + 1 },
        });
      continue;
    }
    if (!line.trim()) continue;
    // A continuation of the last item (indented text under it).
    const top = stack[stack.length - 1];
    if (top && /^\s+\S/.test(line)) {
      const owner = [...stack].reverse().find((s) => s.item)?.item;
      if (owner) owner.text += ` ${plain(line)}`;
      continue;
    }
    // A paragraph: a bold lead-in starts a sub-section; any other paragraph ends the open list.
    stack = [];
    const leadIn = LEAD.exec(line.trim());
    if (leadIn) lead = { kind: kindOf(leadIn[1]), title: plain(leadIn[1]) };
  }
  return out;
}

/** OPEN-QUESTIONS ids an item mentions ("D8", "A11", "C3"). @param {string} text */
export const idsIn = (text) => [
  ...new Set([...text.matchAll(/\b([ADC]\d{1,2})\b/g)].map((m) => m[1])),
];

/**
 * OPEN-QUESTIONS.md: its tables (Design, Behaviour and API, Found in today's code) and the "For HMIF" list.
 * @param {string} md @param {string} file
 */
export function parseOpenQuestions(
  md,
  file = 'ops/redesign/OPEN-QUESTIONS.md',
) {
  const lines = md.split('\n');
  const out = [];
  let section = '';
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    const h = HEADING.exec(line);
    if (h) {
      section = plain(h[2]);
      continue;
    }
    const row = /^\|\s*([ADC]\d{1,2})\s*\|(.*)\|\s*$/.exec(line);
    if (row) {
      const cells = row[2].split('|').map((c) => c.trim());
      const [question, second, third] = cells;
      const found = /found in today/i.test(section);
      const text = plain(question);
      const decided =
        /\*\*decided/i.test(second ?? '') || /\*\*decided/i.test(question);
      out.push({
        id: row[1],
        kind: found ? 'found' : 'open-question',
        group: section,
        text,
        built: found ? null : plain(second ?? ''),
        from: plain((found ? second : third) ?? ''),
        decided: decided ? decisionOf(`${question} ${second ?? ''}`) : null,
        source: { file, section, line: n + 1 },
      });
      continue;
    }
    if (/for hmif/i.test(section)) {
      const li = LIST.exec(line);
      if (li)
        out.push({
          id: null,
          kind: 'open-question',
          group: section,
          text: plain(li[2]),
          built: null,
          from: '',
          decided: null,
          source: { file, section, line: n + 1 },
        });
    }
  }
  return out;
}

/** "Decided 2026-10-13: build it", "Decided by Dev 1 2026-10-13 (…)": who, when and what. @param {string} text */
export function decisionOf(text) {
  const t = plain(text);
  const m =
    /decided by (.+?)\s+(\d{4}-\d{2}-\d{2})[:(]?\s*(.*)$/i.exec(t) ??
    /decided()\s+(\d{4}-\d{2}-\d{2})[:(]?\s*(.*)$/i.exec(t) ??
    /decided(?: by ([^:(]+?))?()[:(]\s*(.*)$/i.exec(t);
  let what = (m?.[3] ?? t).trim();
  // "(review of P2-C, M2): fix it." keeps its words; a lone closing bracket from "Decided … (…" goes.
  if ((what.match(/\)/g) ?? []).length > (what.match(/\(/g) ?? []).length)
    what = what.replace(/\)\s*$/, '').trim();
  return {
    by: m?.[1]?.trim() || (/dev 1/i.test(t) ? 'Dev 1' : 'the owner'),
    date: m?.[2] || null,
    what,
  };
}

/** PLAN.md's "Log": every entry that records a decision. @param {string} md @param {string} file */
export function logDecisions(md, file = 'ops/redesign/PLAN.md') {
  const start = md.indexOf('## Log');
  if (start < 0) return [];
  const before = md.slice(0, start).split('\n').length;
  const lines = md.slice(start).split('\n');
  const out = [];
  for (let n = 0; n < lines.length; n++) {
    const li = /^- (\d{4}-\d{2}-\d{2})(?: (\d\d:\d\d))?: (.*)$/.exec(lines[n]);
    if (!li) continue;
    let text = li[3];
    for (let k = n + 1; k < lines.length && /^\s+\S/.test(lines[k]); k++)
      text += ` ${lines[k].trim()}`;
    if (
      !/decision|decided|the owner (asked|answered|chose|said)|owner's (rule|decision)/i.test(
        text,
      )
    )
      continue;
    out.push({
      date: li[1],
      by:
        /dev 1's decision|decided by dev 1/i.test(text) &&
        !/the owner/i.test(text)
          ? 'Dev 1'
          : 'the owner',
      text: plain(text),
      source: { file, section: 'Log', line: before + n },
    });
  }
  return out;
}

/** Who decides an item. @param {{ kind: string, text: string, group?: string }} item */
export function whoDecides(item) {
  const t = `${item.group ?? ''} ${item.text}`;
  if (
    /welfare/i.test(t) &&
    /(privacy wording|crisis|krisis|hotline|labels?)/i.test(t)
  )
    return 'HMIF Welfare';
  if (
    /for hmif/i.test(item.group ?? '') ||
    /\bHMIF (approval|sign-off|maintainer)|who runs HMIF|production category names|angkatan names|membership status|pemilu/i.test(
      t,
    )
  )
    return 'HMIF';
  if (
    item.kind === 'needs-dev1' ||
    item.kind === 'choice' ||
    item.kind === 'found'
  )
    return 'Dev 1';
  return 'the owner';
}

/** OPEN-QUESTIONS items tagged `security`: still open in production (F1 brief, "What the package is"). */
export const SECURITY_IDS = ['C3', 'C10', 'A12', 'A14', 'C13'];

/**
 * The questions file: OPEN-QUESTIONS first (with ids), then every report's, brief's and note's items, then the log's
 * decisions and F1's own findings. Equal items (same text once plain) are merged, their sources kept.
 * @param {{ openQuestions: string, plan: string, files: { path: string, text: string }[],
 *   findings?: { id: string, title: string, detail: string, owner: string, flows: string[], security?: boolean, fixed?: string }[] }} o
 */
export function buildQuestions({ openQuestions, plan, files, findings = [] }) {
  /** @type {Map<string, any>} */
  const byKey = new Map();
  /** @type {any[]} */
  const items = [];
  const add = (/** @type {any} */ item) => {
    const key = item.id ? `id:${item.id}` : keyOf(item.question);
    const seen = byKey.get(key);
    if (seen) {
      seen.sources.push(...item.sources);
      return;
    }
    byKey.set(key, item);
    items.push(item);
  };
  for (const q of parseOpenQuestions(openQuestions)) {
    add({
      id: q.id,
      kind: q.kind,
      group: q.group,
      question: q.text,
      who: whoDecides({ kind: q.kind, text: q.text, group: q.group }),
      status: q.decided ? 'decided' : q.kind === 'found' ? 'found' : 'open',
      decision: q.decided,
      built: q.built,
      from: q.from,
      tags: q.id && SECURITY_IDS.includes(q.id) ? ['security'] : [],
      related: [],
      sources: [q.source],
    });
  }
  for (const f of files)
    for (const it of extractItems(f.text, f.path)) {
      const decided =
        /\*\*decided|decided by|owner's decision|dev 1's decision/i.test(
          it.text,
        )
          ? decisionOf(it.text)
          : null;
      add({
        id: null,
        kind: it.kind,
        group: it.source.section,
        question: it.text,
        who: whoDecides(it),
        status: decided ? 'decided' : 'open',
        decision: decided,
        built: null,
        from: f.path,
        tags: [],
        related: idsIn(it.text),
        sources: [it.source],
      });
    }
  for (const d of logDecisions(plan))
    add({
      id: null,
      kind: 'decision',
      group: 'PLAN.md log',
      question: d.text,
      who: d.by,
      status: 'decided',
      decision: { by: d.by, date: d.date, what: d.text },
      built: null,
      from: 'PLAN.md',
      tags: [],
      related: idsIn(d.text),
      sources: [d.source],
    });
  for (const f of findings)
    add({
      id: f.id,
      kind: 'finding',
      group: 'F1 findings',
      question: `${f.title}. ${f.detail}`,
      who: 'Dev 1',
      status: f.fixed ? 'decided' : 'open',
      decision: f.fixed ?? null,
      built: null,
      from: 'F1',
      tags: f.security ? ['security', 'finding'] : ['finding'],
      related: [],
      flows: f.flows,
      sources: [
        { file: 'apps/web/e2e/review/findings.ts', section: f.id, line: 0 },
      ],
    });
  const order = ['the owner', 'HMIF', 'HMIF Welfare', 'Dev 1'];
  const groups = order.map((who) => ({
    who,
    items: items.filter((i) => i.who === who),
  }));
  return { total: items.length, groups };
}
