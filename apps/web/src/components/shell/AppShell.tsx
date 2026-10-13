/**
 * The app shell (SPEC "Information architecture and shell"; the prototype's `renderPhone` and `renderDesk` in
 * `garis/app.js`). One layout for every page inside the app:
 * - below 640 px a bottom tab bar, from 640 px the same items as an 88 px rail beside one column, both with a top
 *   bar (Beranda's is gold, with search and your avatar; a tab's page has search and the avatar; any other page
 *   has back and its title);
 * - from 1024 px a sidebar (the official logo, the wordmark, search, every destination, Kelola for pengurus, you at
 *   the foot) and breadcrumbs on pages below a sidebar item.
 * Focused flows (src/lib/shell/routes.ts `focused`) hide the tab bar and rail. The shell owns back, the page's
 * document title, the theme colour, focus after navigation and global search. Screens talk to it through
 * `./page.tsx`.
 */
import {
  Link,
  useLocation,
  useMatches,
  useRouter,
} from '@tanstack/react-router';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  Avatar,
  HmifLogo,
  IconButton,
  Kbd,
  Wordmark,
} from '~/components/garis';
import { DESKTOP_QUERY, useMediaQuery } from '~/components/garis/useMediaQuery';
import { IconBeranda } from '~/components/icons/beranda';
import { IconCari } from '~/components/icons/cari';
import { IconKalender } from '~/components/icons/kalender';
import { IconKelola } from '~/components/icons/kelola';
import { IconKembali } from '~/components/icons/kembali';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconLayanan } from '~/components/icons/layanan';
import { IconPengumuman } from '~/components/icons/pengumuman';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import useSession from '~/hooks/auth/useSession';
import { servicesByGroup } from '~/lib/services';
import { initialsOf } from '~/lib/shell/names';
import { modKeyLabel, opensPalette } from '~/lib/shell/palette';
import {
  activeItem,
  DESTINATION_PATH,
  DESTINATIONS,
  fillPath,
  isRootPage,
  parentOf,
  deskCrumbs,
  ROUTE_META,
  shellPath,
  titleOf,
  type Destination,
  type RouteMeta,
  type ShellPath,
} from '~/lib/shell/routes';
import { currentTheme, subscribe as onThemeChange } from '~/lib/theme/theme';
import { THEME_COLORS } from '~/lib/theme/theme-core.mjs';
import { cn } from '~/lib/utils';
import { badgeText, useNavBadges, type NavBadges } from './nav-badges';
import { focusAfterNavigation } from './focus';
import { LegacyScreen, OwnTitle, TopBarSlot } from './page';
import { openPalette, usePaletteOpen } from './palette/palette-store';
import {
  entryAt,
  recordEntry,
  setLastRoot,
  useLastRoot,
  useTitles,
} from './shell-state';

const loadPalette = () => import('./palette/Palette');
const Palette = lazy(loadPalette);

const ICON: Record<Destination, typeof IconBeranda> = {
  beranda: IconBeranda,
  pengumuman: IconPengumuman,
  kalender: IconKalender,
  layanan: IconLayanan,
};

/** A page the route table doesn't know (an unknown path inside the app): back leads to Beranda. */
const UNKNOWN: RouteMeta = { title: common.app.name, parent: '/' };

interface ShellRoute {
  path: ShellPath | null;
  meta: RouteMeta;
  params: Record<string, string>;
  pathname: string;
  title: string;
  /** This entry's place in the tab's history (TanStack Router's `__TSR_index`). */
  index: number;
  titles: Record<string, string>;
}

function useShellRoute(): ShellRoute {
  const matches = useMatches();
  const leaf = matches[matches.length - 1];
  const location = useLocation();
  const titles = useTitles();
  const path = leaf ? shellPath(leaf.fullPath) : null;
  const params = (leaf?.params ?? {}) as Record<string, string>;
  const title =
    titles[location.pathname] ??
    (path ? titleOf(path, params) : common.app.name);
  return {
    path,
    meta: path ? ROUTE_META[path] : UNKNOWN,
    params,
    pathname: location.pathname,
    title,
    index: (location.state as { __TSR_index?: number }).__TSR_index ?? 0,
    titles,
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const route = useShellRoute();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const router = useRouter();
  const paletteOpen = usePaletteOpen();

  // "Mata kuliahku · PIPS!" in the browser tab and history (SPEC story 25).
  useEffect(() => {
    document.title = fill(common.shell.judulDokumen, { judul: route.title });
  }, [route.title]);

  // What back on the next page says and whether history leads somewhere in the app.
  useEffect(() => {
    recordEntry(route.index, route.pathname, route.title);
  }, [route.index, route.pathname, route.title]);

  useEffect(() => {
    if (route.meta.root) setLastRoot(route.meta.root);
  }, [route.meta.root]);

  // On phones and tablets the browser's bar turns gold on Beranda, joining the header (SPEC "Beranda").
  const goldBar = route.path === '/' && !desk;
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const paint = () =>
      meta.setAttribute(
        'content',
        goldBar
          ? getComputedStyle(document.documentElement)
              .getPropertyValue('--bg-hero')
              .trim()
              .toUpperCase()
          : THEME_COLORS[currentTheme()],
      );
    paint();
    const stop = onThemeChange(paint);
    return () => {
      stop();
      meta.setAttribute('content', THEME_COLORS[currentTheme()]);
    };
  }, [goldBar]);

  useEffect(
    () =>
      router.subscribe('onRendered', (e) => {
        if (!e.fromLocation || !e.pathChanged) return;
        focusAfterNavigation();
      }),
    [router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!opensPalette(e)) return;
      e.preventDefault();
      void loadPalette();
      openPalette();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Frame route={route} desk={desk}>
        {children}
      </Frame>
      {paletteOpen ? (
        <Suspense fallback={null}>
          <Palette />
        </Suspense>
      ) : null}
    </>
  );
}

/**
 * The page area's height (the scrolling area below the top bar or the breadcrumbs) as --g-page-h on `root`, so
 * today's screens that fill "the screen" fill the space between the bars instead (shell.css). Also the sticky top
 * bar's height as --g-top-h, which the scrolling area keeps clear when it brings a focused control into view.
 */
function usePageHeight(
  root: HTMLElement | null,
  pathname: string,
  desk: boolean,
) {
  useEffect(() => {
    if (!root) return;
    const scroller = root.querySelector<HTMLElement>(
      '[data-scroll-restoration-id="isi"]',
    );
    if (!scroller) return;
    const measure = () => {
      const page = scroller.querySelector<HTMLElement>('.g-page');
      if (!page) return;
      const top =
        page.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      root.style.setProperty(
        '--g-page-h',
        `${Math.max(0, scroller.clientHeight - top)}px`,
      );
      const bar = scroller.querySelector<HTMLElement>('.g-top');
      root.style.setProperty('--g-top-h', `${bar ? bar.offsetHeight : 0}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    for (const el of scroller.querySelectorAll('.g-top, .g-crumbs'))
      ro.observe(el);
    return () => ro.disconnect();
  }, [root, pathname, desk]);
}

function SkipLink() {
  return (
    <a className="g-skip" href="#isi">
      {common.shell.langsungKeIsi}
    </a>
  );
}

/** The page itself; today's screens sit on their old light surface until their redesign replaces them. */
function Page({ meta, children }: { meta: RouteMeta; children: ReactNode }) {
  return meta.legacy ? (
    <LegacyScreen className="g-page">{children}</LegacyScreen>
  ) : (
    <div className="g-page">{children}</div>
  );
}

const searchProps = {
  onClick: () => openPalette(),
  onPointerEnter: () => void loadPalette(),
  onFocus: () => void loadPalette(),
};

function useMe() {
  const user = useSession();
  return { name: user.fullName, initials: initialsOf(user.fullName) };
}

function AvatarLink({ name, initials }: { name: string; initials: string }) {
  return (
    <Link
      to="/profil"
      className="g-avatar"
      aria-label={fill(common.shell.profilDari, { nama: name })}
      activeOptions={{ exact: true }}
    >
      <span aria-hidden="true">{initials}</span>
    </Link>
  );
}

/* ================= The frame ================= */

/**
 * One tree for every layout (review M2): the page (`main#isi` and what's in it) and its scrolling area stay at the
 * same place whatever the width, and only the chrome around them changes: the top bar and the tab bar or rail
 * below 1024 px, the sidebar and the breadcrumbs from 1024 px. So rotating a tablet or resizing a window across
 * 1024 px keeps what the member typed and where they were. Chrome that isn't shown renders as null in its slot.
 */
function Frame({
  route,
  desk,
  children,
}: {
  route: ShellRoute;
  desk: boolean;
  children: ReactNode;
}) {
  const me = useMe();
  const lastRoot = useLastRoot();
  const badges = useNavBadges();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  usePageHeight(root, route.pathname, desk);
  const trail = desk && route.path ? deskCrumbs(route.path, route.params) : [];
  // How many titles of its own the screen shows (`PageTitle`): then the top bar's title isn't the page's heading.
  const [ownTitles, setOwnTitles] = useState(0);
  const registerTitle = useCallback(
    (delta: 1 | -1) => setOwnTitles((n) => n + delta),
    [],
  );

  return (
    <div className={desk ? 'g-desk' : 'g-shell'} ref={setRoot}>
      <SkipLink />
      {desk ? (
        <Sidebar route={route} lastRoot={lastRoot} badges={badges} />
      ) : null}
      <div
        className={desk ? 'g-desk-scroll' : 'g-scroll'}
        data-scroll-restoration-id="isi"
      >
        {desk ? null : (
          <TopBar
            route={route}
            lastRoot={lastRoot}
            me={me}
            ownTitle={ownTitles > 0}
            onSlot={setSlot}
          />
        )}
        <main id="isi" tabIndex={-1} className="g-main">
          {trail.length ? <Crumbs route={route} trail={trail} /> : null}
          <OwnTitle.Provider value={registerTitle}>
            <TopBarSlot.Provider value={desk ? null : slot}>
              <Page meta={route.meta}>{children}</Page>
            </TopBarSlot.Provider>
          </OwnTitle.Provider>
        </main>
      </div>
      {desk || route.meta.focused ? null : (
        <TabBar
          active={route.path ? activeItem(route.path, 'touch', lastRoot) : null}
          badges={badges}
        />
      )}
    </div>
  );
}

/* ================= Phones and tablets ================= */

/** The top bar: Beranda's gold bar, a tab's own page (search and you), or back and the page's title. */
function TopBar({
  route,
  lastRoot,
  me,
  ownTitle,
  onSlot,
}: {
  route: ShellRoute;
  lastRoot: Destination;
  me: { name: string; initials: string };
  /** The screen shows its own title (`PageTitle`): this one is plain text, hidden from screen readers. */
  ownTitle: boolean;
  onSlot: (el: HTMLElement | null) => void;
}) {
  const beranda = route.path === '/';
  const root = route.path ? isRootPage(route.path) : false;

  let bar: ReactNode;
  if (beranda) {
    bar = (
      <>
        <button type="button" className="g-search-pill" {...searchProps}>
          <IconCari size={20} />
          <span>{common.shell.cariDiPips}</span>
        </button>
        <AvatarLink {...me} />
      </>
    );
  } else if (root) {
    bar = (
      <>
        <span className="g-top-grow" />
        <IconButton label={common.shell.cariDiPips} {...searchProps}>
          <IconCari />
        </IconButton>
        <AvatarLink {...me} />
      </>
    );
  } else {
    bar = (
      <>
        <BackButton route={route} lastRoot={lastRoot} />
        {ownTitle ? (
          <span className="g-top-title" aria-hidden="true">
            {route.title}
          </span>
        ) : (
          <h1 className="g-top-title" data-page-title="" tabIndex={-1}>
            {route.title}
          </h1>
        )}
        <div className="g-top-actions" ref={onSlot} />
      </>
    );
  }
  return <header className={cn('g-top', beranda && 'gold')}>{bar}</header>;
}

/** Back: to the previous page when history has one from this app, otherwise up to the page above (SPEC story 18). */
function BackButton({
  route,
  lastRoot,
}: {
  route: ShellRoute;
  lastRoot: Destination;
}) {
  const router = useRouter();
  const prev = route.index > 0 ? entryAt(route.index - 1) : undefined;
  const parent = route.path ? parentOf(route.path, lastRoot) : '/';
  const parentHref = (parent && fillPath(parent, route.params)) ?? '/';
  const parentTitle =
    route.titles[parentHref] ??
    (parent ? titleOf(parent, route.params) : common.nav.beranda);
  const label = fill(common.shell.kembaliKe, {
    judul: prev ? prev.title : parentTitle,
  });
  return (
    <IconButton
      label={label}
      onClick={() => {
        if (prev) router.history.back();
        else void router.navigate({ href: parentHref, replace: true });
      }}
    >
      <IconKembali />
    </IconButton>
  );
}

function TabBar({
  active,
  badges,
}: {
  active: string | null;
  badges: NavBadges;
}) {
  const { pathname } = useLocation();
  return (
    <nav className="g-tabbar" aria-label={common.shell.navigasiUtama}>
      {DESTINATIONS.map((d) => {
        const Icon = ICON[d];
        const on = active === d;
        const n = badges[d] ?? 0;
        const to = DESTINATION_PATH[d];
        // A tab's own page again: back to its top, as the prototype does.
        const onClick = (e: MouseEvent) => {
          if (pathname !== to) return;
          e.preventDefault();
          const reduced = matchMedia(
            '(prefers-reduced-motion: reduce)',
          ).matches;
          document
            .querySelector('[data-scroll-restoration-id="isi"]')
            ?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        };
        return (
          <Link
            key={d}
            to={to}
            className="g-tab"
            aria-current={on ? 'page' : undefined}
            activeOptions={{ exact: true }}
            onClick={onClick}
          >
            <span className="cap">
              <Icon size={22} />
            </span>
            {n > 0 ? (
              <span className="g-badge-n" aria-hidden="true">
                {badgeText(n)}
              </span>
            ) : null}
            <span>
              {common.nav[d]}
              {n > 0 ? (
                <span className="sr-only">
                  {`, ${fill(common.shell.belumDibaca, { jumlah: badgeText(n) })}`}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ================= Desktop ================= */

/** The desktop sidebar (`renderDesk`): the official logo, the wordmark, search, every destination, you at the foot. */
function Sidebar({
  route,
  lastRoot,
  badges,
}: {
  route: ShellRoute;
  lastRoot: Destination;
  badges: NavBadges;
}) {
  const me = useMe();
  const user = useSession();
  const active = route.path ? activeItem(route.path, 'desk', lastRoot) : null;
  const kelola = servicesByGroup(user).some((g) => g.group === 'Kelola');
  const mod = modKeyLabel(navigator.platform);

  return (
    <div className="g-side">
      <div className="g-side-brand">
        <HmifLogo width={54} />
        <div>
          <Wordmark size={20} />
          <p className="sub">{common.app.org}</p>
        </div>
      </div>
      <button type="button" className="g-side-search" {...searchProps}>
        <IconCari size={16} />
        <span>{common.shell.cari}</span>
        <Kbd aria-hidden="true">{mod}</Kbd>
      </button>
      <nav className="g-side-nav" aria-label={common.shell.navigasiUtama}>
        {DESTINATIONS.map((d) => {
          const Icon = ICON[d];
          const n = badges[d] ?? 0;
          return (
            <Link
              key={d}
              to={DESTINATION_PATH[d]}
              className="g-side-item"
              aria-current={active === d ? 'page' : undefined}
              activeOptions={{ exact: true }}
            >
              <Icon size={20} />
              <span>{common.nav[d]}</span>
              {n > 0 ? (
                <span className="n">
                  <span aria-hidden="true">{badgeText(n)}</span>
                  <span className="sr-only">
                    {fill(common.shell.belumDibaca, { jumlah: badgeText(n) })}
                  </span>
                </span>
              ) : null}
            </Link>
          );
        })}
        {kelola ? (
          <Link
            to="/kelola"
            className="g-side-item"
            aria-current={active === 'kelola' ? 'page' : undefined}
            activeOptions={{ exact: true }}
          >
            <IconKelola size={20} />
            <span>{common.nav.kelola}</span>
          </Link>
        ) : null}
      </nav>
      <Link
        to="/profil"
        className="g-side-me"
        aria-current={active === 'profil' ? 'page' : undefined}
        activeOptions={{ exact: true }}
      >
        <Avatar initials={me.initials} shape="square" />
        <span>
          <b>{me.name}</b>
          <span className="s">{common.nav.profil}</span>
        </span>
      </Link>
    </div>
  );
}

/** "Layanan › Ding Dong": the page's ancestors from its sidebar item (`crumbs` in the prototype's `renderDesk`). */
function Crumbs({
  route,
  trail,
}: {
  route: ShellRoute;
  trail: ReturnType<typeof deskCrumbs>;
}) {
  return (
    <nav className="g-crumbs" aria-label={common.shell.jejakHalaman}>
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        const title = last
          ? route.title
          : ((c.href && route.titles[c.href]) ?? titleOf(c.path, route.params));
        if (last) {
          return (
            <span key={c.path} aria-current="page">
              {title}
            </span>
          );
        }
        return (
          <span key={c.path} className="contents">
            {c.href ? (
              // A concrete URL (its params filled in) from the route table; lit only by the router's exact match.
              <Link to={c.href as '/'} activeOptions={{ exact: true }}>
                {title}
              </Link>
            ) : (
              <span>{title}</span>
            )}
            <IconLanjut size={14} />
          </span>
        );
      })}
    </nav>
  );
}
