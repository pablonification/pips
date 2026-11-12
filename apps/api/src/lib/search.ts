/**
 * A member's search text as a `to_tsquery` prefix query: every word must start a word in the text ("algo kuis" →
 * `algo:* & kuis:*`). Only letters and digits make words, so `(`, `&`, `!`, `:`, `'` or "C++" can't break the
 * query. `null` when the text has no word at all: such a search matches nothing.
 */
export function prefixTsQuery(search: string): string | null {
  const words = search.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}
