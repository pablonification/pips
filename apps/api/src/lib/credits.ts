/**
 * The student numbers written in the credits ("Name - IF'21 - 13521901"), each once, so Kredit can show those
 * members' photos. At most `CREDIT_PHOTOS_LIMIT`: the text is HMIF's own, but the lookup stays bounded.
 */
export const CREDIT_PHOTOS_LIMIT = 200;

export function creditNims(content: string): string[] {
  const found = content.match(/(?<!\d)\d{8}(?!\d)/g) ?? [];
  return [...new Set(found)].slice(0, CREDIT_PHOTOS_LIMIT);
}
