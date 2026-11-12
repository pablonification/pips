/**
 * Kredit's structure. The server keeps the credits as markdown (`GET /api/markdown/credits`): a "# Credits" title, a
 * group ("## Panitia Khusus"), its teams and roles ("### Frontend", "### Project Owner"), "#### Lead" and "#### Team"
 * inside a team, and one person per line, "Name - IF'21 - 13521901". This reads that shape into groups, teams and
 * people, word for word. Anything else in the text (a paragraph, a link, a person line of another form) gives null,
 * and the page renders the markdown as it is.
 */

export interface CreditPerson {
  name: string;
  /** "IF'21", as written. */
  angkatan: string;
  nim: string;
}

export interface CreditPart {
  /** "Lead", "Team" (as written); null for people listed straight under the team or role. */
  label: string | null;
  people: CreditPerson[];
}

export interface CreditSection {
  title: string;
  parts: CreditPart[];
}

export interface CreditGroup {
  /** "Panitia Khusus"; null for teams before any group. */
  title: string | null;
  sections: CreditSection[];
}

/** A name starts with a letter and holds no markdown (a list marker, a link, emphasis). */
const PERSON =
  /^(\p{L}[^[\]()*_`<>]*?)\s+[-–]\s+([A-Za-z]+'\d{2})\s+[-–]\s+(\d{8})$/u;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;

/** The page's own title already says it: a first heading that is just "Credits" or "Kredit" goes. */
export function dropTitle(markdown: string): string {
  return markdown.replace(/^\s*#[ \t]+(credits|kredit)[ \t]*(\n|$)/i, '');
}

export function parseCredits(markdown: string): CreditGroup[] | null {
  const groups: CreditGroup[] = [];
  let group: CreditGroup | null = null;
  let section: CreditSection | null = null;
  let part: CreditPart | null = null;

  for (const raw of dropTitle(markdown).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const h = HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      const title = h[2];
      if (level === 2) {
        group = { title, sections: [] };
        groups.push(group);
        section = part = null;
      } else if (level === 3) {
        if (!group) {
          group = { title: null, sections: [] };
          groups.push(group);
        }
        section = { title, parts: [] };
        group.sections.push(section);
        part = null;
      } else if (level === 4 && section) {
        part = { label: title, people: [] };
        section.parts.push(part);
      } else return null;
      continue;
    }
    const p = PERSON.exec(line);
    if (!p || !section) return null;
    if (!part) {
      part = { label: null, people: [] };
      section.parts.push(part);
    }
    part.people.push({ name: p[1], angkatan: p[2], nim: p[3] });
  }

  // Every heading holds someone; otherwise the shape isn't the one this page knows.
  const full =
    groups.length > 0 &&
    groups.every(
      (g) =>
        g.sections.length > 0 &&
        g.sections.every(
          (s) =>
            s.parts.length > 0 && s.parts.every((x) => x.people.length > 0),
        ),
    );
  return full ? groups : null;
}

/** A role (Project Owner): its people straight under it, no Lead or Team. Roles sit together as small cards. */
export const isRole = (s: CreditSection) =>
  s.parts.length === 1 && s.parts[0].label === null;

/** A group's sections in runs of roles and of teams, in their order, so each run lays out as one grid. */
export function runs(
  sections: CreditSection[],
): { role: boolean; sections: CreditSection[] }[] {
  const out: { role: boolean; sections: CreditSection[] }[] = [];
  for (const s of sections) {
    const role = isRole(s);
    const last = out.at(-1);
    if (last && last.role === role) last.sections.push(s);
    else out.push({ role, sections: [s] });
  }
  return out;
}

/** "IF'21 · 13521901". */
export const personLine = (p: CreditPerson) => `${p.angkatan} · ${p.nim}`;
