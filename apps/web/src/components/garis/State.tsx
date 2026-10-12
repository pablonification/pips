import type { CSSProperties, ReactNode } from 'react';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconUlang } from '~/components/icons/ulang';
import { cn } from '~/lib/utils';
import { Button } from './Button';
import { GARIS_STRINGS } from './strings';

export interface EmptyStateProps {
  /** What will appear here ("Belum ada form untukmu"). */
  title: ReactNode;
  /** When or how it will appear, or the next step. */
  text?: ReactNode;
  /** One action, if there is a next step. */
  action?: ReactNode;
  className?: string;
}

/** An empty list (garis/ui.js `emptyState`): orientation and at most one action, no decoration. */
export function EmptyState({
  title,
  text,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('g-empty', className)}>
      <p className="t-sub">{title}</p>
      {text ? <p className="t-sm text-fg-2">{text}</p> : null}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  /** What happened, in Indonesian, without raw API text ("Pengumuman gagal dimuat"). */
  title?: ReactNode;
  /** The cause and the fix, when known. */
  text?: ReactNode;
  onRetry: () => void;
  /** True while the retry is running. */
  retrying?: boolean;
  className?: string;
}

/** A failed load, next to where the content would be: what happened, then Coba lagi (SPEC "Patterns"). */
export function ErrorState({
  title = GARIS_STRINGS.errorTitle,
  text,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('g-empty', className)} role="alert">
      <p className="g-err justify-center t-sub">
        <IconPeringatan size={20} />
        {title}
      </p>
      {text ? <p className="t-sm text-fg-2">{text}</p> : null}
      <Button
        variant="paper"
        size="sm"
        onClick={onRetry}
        aria-disabled={retrying || undefined}
        disabled={retrying}
      >
        <IconUlang size={16} />
        {GARIS_STRINGS.retry}
      </Button>
    </div>
  );
}

export interface OfflineBannerProps {
  /** When the data on screen was last updated, as "07.45" (WIB, the app's time format). */
  updatedAt: string;
  className?: string;
}

/** Offline, with the last update time, above data kept from before (SPEC story 135). */
export function OfflineBanner({ updatedAt, className }: OfflineBannerProps) {
  return (
    <div className={cn('g-offline', className)} role="status">
      <IconPeringatan size={16} />
      <span>{GARIS_STRINGS.offline(updatedAt)}</span>
    </div>
  );
}

export interface SkeletonProps {
  /** Names what is loading ("Memuat pengumuman…"). */
  label?: string;
  className?: string;
  children: ReactNode;
}

/** A loading placeholder shaped like the layout it stands for; screen readers hear its label once. */
export function Skeleton({
  label = GARIS_STRINGS.loading,
  className,
  children,
}: SkeletonProps) {
  return (
    <div className={className} role="status" aria-label={label}>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/** A list row being loaded: a tile and three lines (the prototype's `.skel`). */
export function SkeletonRow({
  lines = ['34%', '92%', '68%'],
  tile = true,
}: {
  lines?: string[];
  tile?: boolean;
}) {
  return (
    <div className="g-skel">
      {tile ? <span className="sq" /> : null}
      <span className="bars">
        {lines.map((w, i) => (
          <span key={i} style={{ width: w }} />
        ))}
      </span>
    </div>
  );
}

/** One line of text being loaded. */
export function SkeletonBar({
  width = '100%',
  height = 9,
}: {
  width?: CSSProperties['width'];
  height?: number;
}) {
  return <span className="g-skel-bar" style={{ width, height }} />;
}

/** A card or image being loaded. */
export function SkeletonBlock({
  height,
  className,
}: {
  height: CSSProperties['height'];
  className?: string;
}) {
  return <span className={cn('g-skel-block', className)} style={{ height }} />;
}
