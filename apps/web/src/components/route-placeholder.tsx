/**
 * Stands in for a screen its redesign task hasn't built yet (P0-B gives every new URL a route). Only the
 * page's title, so the URL resolves and the shell around it works; nothing else to remove later.
 */
export function RoutePlaceholder({ title }: { title: string }) {
  return (
    <section className="p-6">
      <h1 className="text-xl font-bold">{title}</h1>
    </section>
  );
}
