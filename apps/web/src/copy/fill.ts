type Placeholders<T extends string> =
  T extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;

/**
 * Puts values into a catalog string: `fill(common.shell.kembaliKe, { judul: 'Beranda' })` for
 * `'Kembali ke {judul}'`. Catalog strings stay plain text, so the glossary check can read every one of them.
 */
export function fill<T extends string>(
  template: T,
  values: Record<Placeholders<T>, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name as Placeholders<T>]) : match,
  );
}
