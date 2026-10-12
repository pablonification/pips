import type { HTMLAttributes, ReactNode } from 'react';
import { IconCentang } from '~/components/icons/centang';
import { cn } from '~/lib/utils';
import { GARIS_STRINGS } from './strings';

type DivProps = HTMLAttributes<HTMLDivElement>;

/** A card (garis.css `.card`): the surface fill with a 1 px ring, no drop. */
export function Card({ className, ...rest }: DivProps) {
  return <div className={cn('g-card', className)} {...rest} />;
}

/**
 * The gold plaque framed in ink, for the one most important thing on a screen: the member card, the Live Counting
 * figure or the form's thank-you. At most one per screen.
 */
export function Plaque({ className, ...rest }: DivProps) {
  return <div className={cn('g-plaque', className)} {...rest} />;
}

export interface TileProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'aria-label'
> {
  /** Gold with an ink rim, only when the row asks you to act inside the app now. */
  gold?: boolean;
  size?: 'md' | 'sm';
  /** What the icon means, when the row doesn't say it in words; without it the tile is decoration. */
  label?: string;
}

/** A 36 px icon tile for list rows (garis.css `.tile`). */
export function Tile({
  gold = false,
  size = 'md',
  label,
  className,
  children,
  ...rest
}: TileProps) {
  // A label on a plain span isn't read (ARIA forbids naming a generic element): the meaning is hidden text, and the
  // icon itself stays hidden.
  return (
    <span
      className={cn('g-tile', gold && 'gold', size === 'sm' && 'sm', className)}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {label ? (
        <>
          <span className="contents" aria-hidden="true">
            {children}
          </span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}

export interface SegbarProps {
  /** How many parts there are, and how many are done. */
  total: number;
  done: number;
  /** What it measures, for screen readers (for example "Bagian 2 dari 5"). */
  label: string;
  className?: string;
}

/** The segmented progress bar (garis.css `.segbar`): one segment per part. */
export function Segbar({ total, done, label, className }: SegbarProps) {
  return (
    <div
      className={cn('g-segbar', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={label}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < done ? 'on' : undefined} />
      ))}
    </div>
  );
}

/** A muted note with an icon (garis.css `.note-box`), for a privacy note or a limit. */
export function NoteBox({
  icon,
  className,
  children,
  ...rest
}: DivProps & { icon?: ReactNode }) {
  return (
    <div className={cn('g-note-box', className)} {...rest}>
      {icon}
      <div className="t-sm text-fg-2">{children}</div>
    </div>
  );
}

/** State shown compactly instead of explained: "Draf tersimpan" with a check (garis.css `.saved`). */
export function Saved({
  children = GARIS_STRINGS.saved,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('g-saved t-cap text-fg-2', className)} role="status">
      <IconCentang size={16} />
      {children}
    </span>
  );
}

export interface MediaProps {
  src?: string;
  alt: string;
  /** Width / height; the space is kept while the image loads. Default 16 / 10, as the feed's images. */
  ratio?: string;
  width?: number;
  height?: number;
  className?: string;
  children?: ReactNode;
}

/**
 * An image (or its placeholder) with the faint outline that keeps it off the page in both themes, keeping its space
 * while it loads (SPEC story 129). The one place new code renders <img> for content.
 */
export function Media({
  src,
  alt,
  ratio = '16 / 10',
  width,
  height,
  className,
  children,
}: MediaProps) {
  return (
    <div className={cn('g-media', className)} style={{ aspectRatio: ratio }}>
      {src ? (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      {children}
    </div>
  );
}
