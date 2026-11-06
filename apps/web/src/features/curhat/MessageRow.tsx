/**
 * One message in a room, as chat apps show it (owner's chat changes, 2026-11-06): the bubble, and Balas as a small
 * icon beside it instead of a text button under every bubble. With a mouse it shows on hovering the message; with
 * the keyboard, when Tab reaches it; on touch, swiping the bubble sideways replies, and tapping the bubble shows the
 * icon. Screen readers find it as the button "Balas" after the message. Shared by the member's room and Welfare's
 * inbox (P3-C).
 */
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { IconButton } from '~/components/garis';
import { IconBalas } from '~/components/icons/balas';
import { curhat as t } from '~/copy/curhat';
import { cn } from '~/lib/utils';

/** How far a swipe must go to reply, and how far the bubble follows the finger. */
export const SWIPE_REPLY_PX = 56;
const SWIPE_MAX_PX = 72;
/** A touch that moves less than this is a tap. */
const TAP_SLOP_PX = 8;

export function MessageRow({
  side,
  start,
  end,
  onReply,
  children,
  after,
}: {
  /** `me`: on the right in gold; `them`: on the left on paper. */
  side: 'me' | 'them';
  /** The first and last bubble of its group (`groupThread`). */
  start: boolean;
  end: boolean;
  /** Null when the message can't be replied to (not delivered yet). */
  onReply: (() => void) | null;
  /** The bubble's content. */
  children: ReactNode;
  /** Under the bubble: a failed message's Gagal and Kirim ulang. */
  after?: ReactNode;
}) {
  const row = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; id: number; moved: boolean }>(
    null,
  );

  // A tap shows the icon until the next touch elsewhere.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!row.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const swipe = onReply
    ? {
        onPointerDown: (e: PointerEvent) => {
          if (e.pointerType !== 'touch') return;
          touch.current = {
            x: e.clientX,
            y: e.clientY,
            id: e.pointerId,
            moved: false,
          };
        },
        onPointerMove: (e: PointerEvent) => {
          const s = touch.current;
          if (!s || s.id !== e.pointerId) return;
          const x = e.clientX - s.x;
          const y = e.clientY - s.y;
          if (!s.moved && Math.hypot(x, y) > TAP_SLOP_PX) {
            // Up and down is the page's scroll: let it go.
            if (Math.abs(y) > Math.abs(x)) {
              touch.current = null;
              setDx(0);
              return;
            }
            s.moved = true;
          }
          // Toward the middle: your bubbles to the left, the other side's to the right.
          if (s.moved)
            setDx(
              side === 'me'
                ? Math.max(-SWIPE_MAX_PX, Math.min(0, x))
                : Math.min(SWIPE_MAX_PX, Math.max(0, x)),
            );
        },
        onPointerUp: (e: PointerEvent) => {
          const s = touch.current;
          touch.current = null;
          if (!s || s.id !== e.pointerId) return;
          if (!s.moved) setOpen((o) => !o);
          else if (Math.abs(dx) >= SWIPE_REPLY_PX) {
            setOpen(false);
            onReply();
          }
          setDx(0);
        },
        onPointerCancel: () => {
          touch.current = null;
          setDx(0);
        },
      }
    : {};

  return (
    <>
      <div
        ref={row}
        className={cn(
          'g-msg',
          side,
          start && 'start',
          end && 'end',
          open && 'open',
        )}
      >
        <div
          className={cn('g-bubble', side, dx !== 0 && 'swiping')}
          style={dx ? { translate: `${dx}px 0` } : undefined}
          {...swipe}
        >
          {children}
        </div>
        {onReply ? (
          <IconButton
            size="sm"
            label={t.ruang.balas}
            className="g-msg-reply"
            data-ready={Math.abs(dx) >= SWIPE_REPLY_PX || undefined}
            onClick={() => {
              setOpen(false);
              onReply();
            }}
          >
            <IconBalas size={16} />
          </IconButton>
        ) : null}
      </div>
      {after}
    </>
  );
}
