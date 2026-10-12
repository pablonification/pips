import type { ButtonHTMLAttributes, HTMLAttributes, Ref } from 'react';
import { cn } from '~/lib/utils';
import { PixelReaction } from './PixelReaction';
import type { PixelReactionKey } from './pixel-art';

export interface ReactionButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  reaction: PixelReactionKey;
  count: number;
  /** This member's own reaction. */
  mine: boolean;
  /** The whole sentence screen readers hear ("Keren, 12 orang, termasuk kamu"); the screen words it. */
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

/** One reaction with its count, which the member can press (garis.css `.react`). */
export function ReactionButton({
  reaction,
  count,
  mine,
  label,
  className,
  type,
  ...rest
}: ReactionButtonProps) {
  return (
    <button
      className={cn('g-react', className)}
      type={type ?? 'button'}
      aria-pressed={mine}
      aria-label={label}
      {...rest}
    >
      <PixelReaction reaction={reaction} size={20} />
      <span>{count}</span>
    </button>
  );
}

/** The row of reactions under a post (garis.css `.reacts`). */
export function Reactions({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('g-reacts', className)} {...rest} />;
}

/**
 * The top reactions overlapped, as on a feed row's reaction button (garis.css `.stackpx`). Decorative: the button
 * names the reactions and the total.
 */
export function ReactionStack({
  reactions,
  size = 20,
  className,
}: {
  reactions: PixelReactionKey[];
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn('g-stackpx', className)} aria-hidden="true">
      {reactions.map((r) => (
        <PixelReaction key={r} reaction={r} size={size} />
      ))}
    </span>
  );
}
