import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { common } from '~/copy/common';

/**
 * A deadline line (garis.css `.due`): gold-brown, tabular figures; `urgent` (due today or overdue) turns it red. The
 * words say when ("Hari ini, 23.59"), so colour is never the only signal.
 */
export function Due({
  urgent = false,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { urgent?: boolean }) {
  return (
    <span className={cn('g-due', urgent && 'urgent', className)} {...rest} />
  );
}

/**
 * The bar at the start of a feed row (garis.css `.unread-bar`, `.read-bar`): gold while unread, an empty slot once read,
 * so rows stay aligned. Decorative: the row says "belum dibaca" in words for screen readers.
 */
export function UnreadBar({ unread }: { unread: boolean }) {
  return (
    <span
      className={unread ? 'g-unread-bar' : 'g-read-bar'}
      aria-hidden="true"
    />
  );
}

/** A keyboard shortcut hint (garis.css `.kbd`), such as the sidebar search's ⌘K. */
export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <kbd className={cn('g-kbd', className)} {...rest} />;
}

/** A course's credits as an inverse square (garis.css `.sks`). Decorative: the row names the course. */
export function SksMark({
  sks,
  className,
}: {
  sks: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('g-sks', className)} aria-hidden="true">
      <b>{sks}</b>
      <span>{common.komponen.sks}</span>
    </span>
  );
}
