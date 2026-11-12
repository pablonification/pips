/**
 * The distinct URLs in a text, in order of appearance: http, https and ftp addresses, and bare domains such as
 * `www.example.co.uk`. Empty when there are none.
 */
export function extractUrls(text: string): string[] {
  // The user-info before `@` and the number of domain labels are bounded so the pattern can't backtrack across the
  // whole text from every starting point: unbounded, text like "a:a:a:…" or "a.a.a.…" takes seconds to read.
  const urlRegex =
    /\b((?:(https?|ftp):\/\/)?(?:\S{1,64}@)?(?:www\.)?(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.){1,32}[A-Za-z]{2,6}(?:\.[A-Za-z]{2,6})?(?::\d{1,5})?(?:\/\S*)?)\b/g;
  const urls = text.match(urlRegex) || [];
  return [...new Set(urls)];
}

/** Removes punctuation and symbols from the start and end of a string: `"!Hello, world!"` gives `"Hello, world"`. */
export function removePunctuation(str: string): string {
  const punctuationRegex = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;
  return str.replace(punctuationRegex, '');
}
