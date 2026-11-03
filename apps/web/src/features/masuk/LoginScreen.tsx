import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
// Straight from their files, not the barrel: /login is the first page a new member loads, and the barrel's chunk
// brings the overlays' dialog library along.
import { Button } from '~/components/garis/Button';
import { HmifLogo } from '~/components/garis/HmifLogo';
import { IconButton } from '~/components/garis/IconButton';
import { PixelReaction } from '~/components/garis/PixelReaction';
import type { PixelReactionKey } from '~/components/garis/pixel-art';
import { DESKTOP_QUERY, useMediaQuery } from '~/components/garis/useMediaQuery';
import { Wordmark } from '~/components/garis/Wordmark';
import { IconKembali } from '~/components/icons/kembali';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconUlang } from '~/components/icons/ulang';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { masuk as copy } from '~/copy/masuk';
import useLogin from '~/hooks/auth/useLogin';
import { cn } from '~/lib/utils';
import {
  BOARD_REACTIONS,
  GoogleG,
  MasukHalftone,
  KeyGlyph,
  KEY_ROWS,
  SLIDE_HERO,
  type KeyName,
} from './parts';
import { TestLoginForm } from './TestLoginForm';
import './masuk.css';

const MESSAGES = {
  'bukan-anggota': copy.bukanAnggota,
  gagal: copy.gagal,
  'popup-diblokir': copy.popupDiblokir,
} as const;

const LAST = copy.slides.length - 1;
/** The first slide's keys answer once the entrance has played (screens-masuk.js `masukRender`). */
const ENTRANCE_MS = 900;

const reduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Float {
  id: number;
  px: PixelReactionKey;
  left: number;
  top: number;
}

/**
 * Sign-in (`/login`, outside the shell): Garis v5's Masuk screen (garis/screens-masuk.js, locked 2026-11-02). A gold
 * keyboard of PIPS!'s services over four slides, then Masuk dengan Google, its hint and what went wrong. Phones and
 * tablets stack the hero over a sheet; desktop puts the hero and the slides on the left and signing in on the right.
 * Each slide lights its keys and a reaction rises; a tapped key presses down; the keys type while signing in.
 * The sign-in itself is useLogin's, unchanged. Staging builds add the test login.
 */
export function LoginScreen({ redirectTo }: { redirectTo: string | null }) {
  const { login, retry, pending, problem, devLogin } = useLogin(redirectTo);
  const desk = useMediaQuery(DESKTOP_QUERY);
  const layout = desk ? 'desk' : 'phone';

  const [slide, setSlide] = useState(0);
  // The header answers the slides once the entrance has played.
  const [lit, setLit] = useState(false);
  const [down, setDown] = useState<KeyName | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const [nudge, setNudge] = useState(false);

  const rowsRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const floatId = useRef(0);
  const floatedFor = useRef<number | null>(null);
  // While dots, arrows or arrow keys scroll the track, the slides it passes don't count as chosen.
  const scrollingTo = useRef<{ i: number; until: number } | null>(null);

  useEffect(() => {
    document.title = fill(common.shell.judulDokumen, { judul: copy.judul });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLit(true), reduced() ? 0 : ENTRANCE_MS);
    return () => clearTimeout(t);
  }, []);

  // A pixel reaction rises from a key and fades (never under reduced motion).
  const float = (key: KeyName, px: PixelReactionKey) => {
    const rows = rowsRef.current;
    const el = rows?.querySelector<HTMLElement>(`[data-key="${key}"]`);
    if (!rows || !el || reduced()) return;
    const a = rows.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const id = ++floatId.current;
    setFloats((f) => [
      ...f,
      {
        id,
        px,
        left: r.left - a.left + r.width / 2 - 15,
        top: r.top - a.top - 20,
      },
    ]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1200);
  };

  // Each slide makes the header answer: its keys press down and a reaction rises from the first.
  useEffect(() => {
    if (!lit || floatedFor.current === slide) return;
    floatedFor.current = slide;
    float(SLIDE_HERO[slide].keys[0], SLIDE_HERO[slide].px);
  }, [lit, slide]);

  // The other layout's track (after a resize across 1024 px) starts on the slide already shown.
  useEffect(() => {
    const tr = trackRef.current;
    if (tr) tr.scrollLeft = slide * tr.clientWidth;
    // Only when the layout changes: scrolling sets `slide`, not the other way round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // An error nudges the button, and focus goes to the next step: Coba lagi when there is one.
  useEffect(() => {
    if (!problem) return;
    setNudge(true);
    const t = setTimeout(() => setNudge(false), 400);
    if (problem === 'gagal') retryRef.current?.focus();
    return () => clearTimeout(t);
  }, [problem]);

  const go = (to: number) => {
    const i = Math.max(0, Math.min(LAST, to));
    const tr = trackRef.current;
    if (tr && tr.clientWidth) {
      scrollingTo.current = { i, until: Date.now() + 800 };
      tr.scrollTo({
        left: i * tr.clientWidth,
        behavior: reduced() ? 'auto' : 'smooth',
      });
    }
    setSlide(i);
  };

  const onScroll = () => {
    const tr = trackRef.current;
    if (!tr || !tr.clientWidth) return;
    const i = Math.round(tr.scrollLeft / tr.clientWidth);
    const target = scrollingTo.current;
    if (target) {
      if (i !== target.i && Date.now() < target.until) return;
      scrollingTo.current = null;
    }
    setSlide(Math.max(0, Math.min(LAST, i)));
  };

  // Tapping a key presses it and a reaction rises: a small thing to find, nothing depends on it.
  const tap = (key: KeyName) => {
    setDown(key);
    setTimeout(() => setDown((d) => (d === key ? null : d)), 160);
    float(
      key,
      BOARD_REACTIONS[Math.floor(Math.random() * BOARD_REACTIONS.length)][0],
    );
  };

  const hero = SLIDE_HERO[slide];
  let n = 0;
  const board = (
    <div className="g-mk-art g-mk-board" aria-hidden="true">
      <div className="g-mk-rows" ref={rowsRef}>
        {KEY_ROWS.map((row) => (
          <div className="g-mk-row" key={row.join()}>
            {row.map((key) => {
              const i = n++;
              const on = lit ? hero.keys.indexOf(key) : -1;
              const style = {
                '--i': i,
                '--d': `${Math.max(0, on) * 90}ms`,
              } as CSSProperties;
              return (
                <span
                  key={key}
                  className={cn(
                    'g-mk-key',
                    key === 'pips' && 'home',
                    on >= 0 && 'on',
                    down === key && 'down',
                  )}
                  data-key={key}
                  style={style}
                  onPointerDown={() => tap(key)}
                >
                  {key === 'pips' ? (
                    <Wordmark size={20} />
                  ) : (
                    <KeyGlyph name={key} />
                  )}
                </span>
              );
            })}
          </div>
        ))}
        {BOARD_REACTIONS.map(([px, cls], i) => (
          <span
            key={cls}
            className={cn('g-mk-px', cls)}
            style={{ '--i': i } as CSSProperties}
          >
            <PixelReaction reaction={px} size={30} />
          </span>
        ))}
        {floats.map((f) => (
          <span
            key={f.id}
            className="g-mk-float"
            style={{ left: f.left, top: f.top }}
          >
            <PixelReaction reaction={f.px} size={30} />
          </span>
        ))}
      </div>
    </div>
  );

  const slides = (
    <section
      className="g-mk-car"
      aria-roledescription="carousel"
      aria-label={copy.kenalan}
    >
      <div
        className="g-mk-track"
        ref={trackRef}
        tabIndex={0}
        aria-label={copy.geser}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          go(slide + (e.key === 'ArrowRight' ? 1 : -1));
        }}
      >
        {copy.slides.map((s, i) => (
          <div
            key={s.judul}
            className="g-mk-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={fill(copy.dariJumlah, {
              nomor: i + 1,
              jumlah: copy.slides.length,
            })}
          >
            <h2 className="t-title">{s.judul}</h2>
            <p className="g-mk-line t-body">{s.isi}</p>
          </div>
        ))}
      </div>
      <div className="g-mk-nav">
        {desk ? (
          <IconButton
            className="g-mk-arrow"
            label={copy.sebelumnya}
            onClick={() => go(slide - 1)}
          >
            <IconKembali size={20} />
          </IconButton>
        ) : null}
        <div className="g-mk-dots">
          {copy.slides.map((s, i) => (
            <button
              key={s.judul}
              type="button"
              className="g-mk-dot"
              aria-label={s.judul}
              aria-current={i === slide ? 'true' : undefined}
              onClick={() => go(i)}
            >
              <i />
            </button>
          ))}
        </div>
        {desk ? (
          <IconButton
            className="g-mk-arrow"
            label={copy.berikutnya}
            onClick={() => go(slide + 1)}
          >
            <IconLanjut size={20} />
          </IconButton>
        ) : null}
      </div>
    </section>
  );

  const act = (
    <div className="g-mk-act">
      <Button
        variant="gold"
        wide
        className={cn('g-mk-go', nudge && 'nudge')}
        aria-disabled={pending || undefined}
        onClick={() => {
          if (!pending) login();
        }}
      >
        {pending ? (
          <>
            <span className="g-mk-load" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {copy.memproses}
          </>
        ) : (
          <>
            <GoogleG />
            {copy.google}
          </>
        )}
      </Button>
      <div role="alert" className="g-mk-alert">
        {problem ? (
          <div className="g-mk-err-box">
            <p className="g-mk-err t-sm">
              <IconPeringatan size={16} />
              <span>{MESSAGES[problem]}</span>
            </p>
            {problem === 'gagal' ? (
              <Button variant="paper" size="sm" ref={retryRef} onClick={retry}>
                <IconUlang size={16} />
                {common.actions.cobaLagi}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const testLogin: ReactNode = __TEST_LOGIN_ENABLED__ ? (
    <TestLoginForm
      onSubmit={(c) => devLogin.mutate(c)}
      pending={devLogin.isPending || devLogin.isSuccess}
      error={devLogin.error}
    />
  ) : null;

  const greeting = (
    <h1
      className={cn(desk ? 't-display-l' : 't-display', 'g-mk-hi')}
      tabIndex={-1}
    >
      {copy.halo}
    </h1>
  );

  return (
    <main
      id="isi"
      className={cn('g-mk', layout, pending && 'busy')}
      data-mk={layout}
    >
      {desk ? (
        <>
          <div className="g-mk-hero">
            <div className="g-mk-ht">
              <MasukHalftone length={360} />
            </div>
            {board}
            {slides}
          </div>
          <div className="g-mk-side">
            <div className="g-mk-form">
              <div className="g-side-brand g-mk-brand">
                <HmifLogo width={54} />
                <div>
                  <Wordmark size={20} />
                  <p className="sub">{common.app.org}</p>
                </div>
              </div>
              <div className="g-mk-intro">{greeting}</div>
              {act}
              {testLogin}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="g-mk-hero">
            <div className="g-mk-top">
              {greeting}
              {/* On gold, the logo sits on an ink plate. */}
              <HmifLogo width={48} plate />
            </div>
            {board}
            <div className="g-mk-ht">
              <MasukHalftone length={240} />
            </div>
          </div>
          <div className="g-mk-sheet">
            {slides}
            {act}
            {testLogin}
          </div>
        </>
      )}
    </main>
  );
}
