/**
 * Pieces a card, a row and a post share: link previews, photos, the reaction picker, share, and small hooks.
 * From the prototype's garis/screens-core.js (`linkCard`, `picker`, `reactSummaryBtn`) and app.js (`share`).
 */
import { useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { api } from '~/api/client';
import type { Info, ReactionAggregate } from '~/api/generated';
import {
  Dialog,
  IconButton,
  Media,
  PixelReaction,
  ReactionStack,
  Tile,
  toast,
} from '~/components/garis';
import type { PixelReactionKey } from '~/components/garis/pixel-art';
import { IconForm } from '~/components/icons/form';
import { IconKembali } from '~/components/icons/kembali';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconLembar } from '~/components/icons/lembar';
import { IconLuar } from '~/components/icons/luar';
import { IconReaksi } from '~/components/icons/reaksi';
import { IconTautan } from '~/components/icons/tautan';
import { fill } from '~/copy/fill';
import { pengumuman as t } from '~/copy/pengumuman';
import { extractUrls } from '~/lib/url-parser';
import { cn } from '~/lib/utils';
import {
  absoluteUrl,
  hostOf,
  linkKind,
  myReaction,
  reactionLabel,
  REACTION_KEYS,
  reactionTotal,
  summaryLabel,
  topReactions,
} from './rules';

/* ================= Small hooks ================= */

/** Whether the element has scrolled into view (once): previews and paging load then. */
/**
 * Whether the element is in view (or 200 px from it). Takes the element itself (a callback ref's state), so it
 * starts watching when the element first renders, not only when the component mounts: the feed's end marker
 * appears after the loading state.
 */
export function useElementInView(el: Element | null, once = true) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit || !once) setSeen(hit);
        if (hit && once) io.disconnect();
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, once]);
  return seen;
}

const onlineSubscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};
export const useOnline = () =>
  useSyncExternalStore(
    onlineSubscribe,
    () => navigator.onLine,
    () => true,
  );

/** After `ms`, true: skeletons appear only for a load slower than 300 ms (SPEC "States"). */
export function useDelayed(active: boolean, ms = 300) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) {
      setLate(false);
      return;
    }
    const id = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(id);
  }, [active, ms]);
  return active && late;
}

/** Escape and a press outside close an inline popover (the picker); focus goes back to its trigger. */
export function useDismiss(
  open: boolean,
  close: (returnFocus: boolean) => void,
  refs: RefObject<HTMLElement | null>[],
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (refs.some((r) => r.current?.contains(target))) return;
      close(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, close, refs]);
}

/* ================= Text with its links ================= */

/** The post's text with every link made a link (today's `renderInfoContent`, without its 300-character cut). */
export function Linkified({ text }: { text: string }) {
  const urls = extractUrls(text);
  if (!urls.length) return <>{text}</>;
  const pattern = new RegExp(
    `(${urls.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g',
  );
  return (
    <>
      {text.split(pattern).map((part, i) =>
        urls.includes(part) ? (
          <a
            key={i}
            href={absoluteUrl(part)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
            <span className="sr-only"> {t.post.situsLuar}</span>
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/* ================= Link previews ================= */

function useOpenGraph(url: string, enabled: boolean) {
  return useQuery({
    queryKey: ['openGraph', url],
    queryFn: () => api.openGraph.openGraphScrape({ url: absoluteUrl(url) }),
    enabled,
    // As today: a preview is good for a day.
    staleTime: 1000 * 60 * 60 * 24,
    retry: false,
  });
}

function LinkCard({
  url,
  onForm,
}: {
  url: string;
  onForm: (url: string, title: string) => void;
}) {
  const [el, ref] = useState<Element | null>(null);
  const seen = useElementInView(el);
  const { data } = useOpenGraph(url, seen);
  const og = data && 'success' in data && data.success ? data : null;
  const kind = linkKind(url, og as never);
  const host = hostOf(url);
  const title = (og as { ogTitle?: string } | null)?.ogTitle || url;
  if (kind === 'gform')
    return (
      <button
        type="button"
        ref={ref}
        className="g-lp"
        onClick={() => onForm(absoluteUrl(url), title)}
      >
        <Tile gold>
          <IconForm size={20} />
        </Tile>
        <span className="min-w-0 flex-1 grow">
          <span className="host">{t.post.googleForm}</span>
          <span className="ttl">{title}</span>
        </span>
        <span className="end">
          <IconLanjut size={16} />
        </span>
      </button>
    );
  return (
    <a
      ref={ref}
      className="g-lp"
      href={absoluteUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Tile>
        {kind === 'sheet' ? <IconLembar size={20} /> : <IconTautan size={20} />}
      </Tile>
      <span className="min-w-0 flex-1">
        <span className="host">{host}</span>
        <span className="ttl">{title}</span>
      </span>
      <span className="end">
        <IconLuar size={16} />
        <span className="sr-only">{t.post.situsLuar}</span>
      </span>
    </a>
  );
}

/** One card per link in the post's text; Google Forms open inside PIPS! (today's `EmbeddedGform`). */
export function LinkCards({ info }: { info: Pick<Info, 'content'> }) {
  const urls = extractUrls(info.content);
  const [form, setForm] = useState<{ url: string; title: string } | null>(null);
  if (!urls.length) return null;
  return (
    <>
      {urls.map((u) => (
        <LinkCard
          key={u}
          url={u}
          onForm={(url, title) => setForm({ url, title })}
        />
      ))}
      <Dialog
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        title={form?.title ?? t.post.googleForm}
        className="wide"
        footer={
          form ? (
            <a
              className="g-link"
              href={form.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.post.bukaTabBaru}
              <IconLuar size={16} />
            </a>
          ) : null
        }
      >
        {form ? (
          <iframe className="g-gform" src={form.url} title={form.title} />
        ) : null}
      </Dialog>
    </>
  );
}

/* ================= Photos ================= */

type Medias = NonNullable<Info['infoMedias']>;

/** The post's photos in the 16:10 frame (lazy below the fold), opening the full-size viewer. */
export function Photos({ medias }: { medias: Medias }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!medias.length) return null;
  const sorted = [...medias].sort((a, b) => a.order - b.order);
  const alt = (i: number) =>
    fill(t.post.foto, { nomor: i + 1, jumlah: sorted.length });
  return (
    <>
      <div className={cn('g-photos z', sorted.length > 1 && 'many')}>
        {sorted.map((m, i) => (
          <button
            key={m.mediaId}
            type="button"
            className="g-photo-btn"
            onClick={() => setOpen(i)}
          >
            <Media src={m.media.url} alt={alt(i)} />
          </button>
        ))}
      </div>
      <Dialog
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={t.post.fotoPengumuman}
        className="wide"
      >
        {open !== null ? (
          <div
            className="g-viewer"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' && open < sorted.length - 1)
                setOpen(open + 1);
              if (e.key === 'ArrowLeft' && open > 0) setOpen(open - 1);
            }}
          >
            <Media src={sorted[open].media.url} alt={alt(open)} ratio="auto" />
            {sorted.length > 1 ? (
              <div className="g-viewer-nav">
                <IconButton
                  label={t.post.fotoSebelumnya}
                  disabled={open === 0}
                  onClick={() => setOpen(open - 1)}
                >
                  <IconKembali size={20} />
                </IconButton>
                <span aria-live="polite">{alt(open)}</span>
                <IconButton
                  label={t.post.fotoBerikutnya}
                  disabled={open === sorted.length - 1}
                  onClick={() => setOpen(open + 1)}
                >
                  <IconLanjut size={20} />
                </IconButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

/* ================= Reactions ================= */

/** The six reactions; yours pressed (`picker`). Two rows of three on the narrowest phones (CSS). */
export function ReactionPicker({
  mine,
  onPick,
  pickerRef,
}: {
  mine: PixelReactionKey | null;
  onPick: (key: PixelReactionKey) => void;
  pickerRef?: RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const root = pickerRef ?? ref;
  // Opening it puts focus on your reaction, or the first.
  useEffect(() => {
    const el = root.current;
    (
      el?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      el?.querySelector<HTMLElement>('button')
    )?.focus();
  }, [root]);
  return (
    <div
      className="g-picker"
      role="group"
      aria-label={t.reaksi.pilih}
      ref={root}
    >
      {REACTION_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={mine === k}
          aria-label={reactionLabel(k)}
          title={reactionLabel(k)}
          onClick={() => onPick(k)}
        >
          <PixelReaction reaction={k} size={30} />
        </button>
      ))}
    </div>
  );
}

/** The feed's reaction button: the top three stacked and the total (`reactSummaryBtn`). */
export function ReactSummaryButton({
  reactions,
  open,
  onClick,
  buttonRef,
}: {
  reactions: ReactionAggregate;
  open: boolean;
  onClick: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const top = topReactions(reactions);
  const total = reactionTotal(reactions);
  return (
    <button
      ref={buttonRef}
      type="button"
      className="g-foot-btn"
      aria-expanded={open}
      aria-label={summaryLabel(reactions)}
      onClick={onClick}
    >
      {top.length ? (
        <ReactionStack reactions={top} size={20} />
      ) : (
        <IconReaksi size={20} />
      )}
      <span aria-hidden="true">{total || ''}</span>
    </button>
  );
}

export { myReaction };

/* ================= Share ================= */

export const postUrl = (id: string) =>
  `${window.location.origin}/pengumuman/${id}`;
export const postName = (info: Pick<Info, 'title' | 'creator'>) =>
  info.title || fill(t.post.dari, { nama: info.creator.fullName });

/** Web Share with the title and the post's address; otherwise copy the address. */
export async function sharePost(info: Pick<Info, 'id' | 'title' | 'creator'>) {
  const url = postUrl(info.id);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: postName(info), url });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // Refused (no permission, or no clipboard at all): say so rather than claim it was copied.
    toast.error(t.bagikan.gagalSalin);
    return;
  }
  toast.success(t.bagikan.disalin);
}

export function Sr({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
