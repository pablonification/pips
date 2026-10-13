/**
 * What a screen uses from the shell (P0-C). The shell draws the bars, the rail, the sidebar, back and the
 * breadcrumbs; a screen gives it its title and actions through these, and lays itself out with `PageBody`.
 *
 * - `usePageTitle('Form Analisis Kondisi PIXEL')`: a title from the screen's data. It replaces the route's title
 *   (src/lib/shell/routes.ts) in the phone top bar, the breadcrumbs, the next page's back ("Kembali ke …") and
 *   the document title ("… · PIPS!").
 * - `<PageTitle>`: the page's `h1`, when the screen shows its own title: a tab's page, or a drill-down page with a
 *   heading of its own (P1-B's post detail: the post's title under a top bar that says "Pengumuman"). On a
 *   drill-down page the top bar then keeps showing the page's name, but as plain text hidden from screen readers,
 *   so the page has one `h1`, the screen's, and the shell moves focus to it after each navigation (the prototype's
 *   `hasTitle` in renderPhone).
 *   A split page on desktop (the post beside the feed) sets `crumbs: false` in src/lib/shell/routes.ts.
 * - `<DeskHead title actions>`: the desktop page head (the prototype's `deskHead`); hidden below 1024 px, where the
 *   top bar has the title.
 * - `<TopBarActions>`: up to two actions in the phone and tablet top bar of a drill-down page (share, the post's
 *   menu, delete a room). Rendered nowhere on desktop: put them in `DeskHead` there.
 * - `<PageBody wide>`: the content column: the prototype's `p-body` on phones (one 720 px column on tablets), its
 *   `d-pad d-narrow` (reading and forms) or, `wide`, the dashboard width on desktop.
 */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from '@tanstack/react-router';
import { cn } from '~/lib/utils';
import { titleAppeared } from './focus';
import { setTitleFor } from './shell-state';

/** Gives the current page a title from its data (see above). */
export function usePageTitle(title: string | null | undefined) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (title) setTitleFor(pathname, title);
  }, [pathname, title]);
}

/** The shell counts the screen's own titles on the page, so the top bar knows whether its title is the heading. */
export const OwnTitle = createContext<((delta: 1 | -1) => void) | null>(null);

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  /** false: the screen's own type style instead of the page title's Archivo (a post's title, P1-B). */
  display?: boolean;
};

function Heading({
  className,
  display = true,
  ...rest
}: HeadingProps & { ref?: Ref<HTMLHeadingElement> }) {
  return (
    <h1
      data-page-title=""
      tabIndex={-1}
      className={cn(display && 't-display', className)}
      {...rest}
    />
  );
}

export function PageTitle(props: HeadingProps) {
  const register = useContext(OwnTitle);
  const ref = useRef<HTMLHeadingElement>(null);
  // Before paint, so the top bar never shows a second h1, and focus after navigation finds this one, also when it
  // appears after the shell moved focus (focus.ts).
  useLayoutEffect(() => {
    if (ref.current) titleAppeared(ref.current);
    if (!register) return;
    register(1);
    return () => register(-1);
  }, [register]);
  return <Heading ref={ref} {...props} />;
}

export function DeskHead({
  title,
  actions,
}: {
  title: ReactNode;
  actions?: ReactNode;
}) {
  // Hidden below 1024 px, where the top bar has the title: so it doesn't count as the screen's own title there.
  return (
    <div className="g-d-head">
      <Heading className="t-display-l">{title}</Heading>
      {actions}
    </div>
  );
}

export function PageBody({
  wide = false,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return <div className={cn('g-body', wide && 'wide', className)} {...rest} />;
}

export const TopBarSlot = createContext<HTMLElement | null>(null);

export function TopBarActions({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarSlot);
  return slot ? createPortal(children, slot) : null;
}

/**
 * Today's screen on its old light surface, inside the new shell, until its redesign replaces it. The shell wraps
 * every route the table marks `legacy`; use this only for old parts inside a redesigned page (Beranda until P1-A).
 */
export function LegacyScreen({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('g-legacy theme-light', className)}
      data-legacy=""
      {...rest}
    />
  );
}
