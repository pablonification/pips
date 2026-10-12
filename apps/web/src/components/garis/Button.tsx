import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '~/lib/utils';

export type ButtonVariant =
  'gold' | 'paper' | 'ghost' | 'danger' | 'danger-ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** gold: the one main action (a keycap that presses down); paper: secondary; ghost: quiet; danger. */
  variant?: ButtonVariant;
  /** sm is the 34 px compact button for rows (its touch hit area still reaches 44 px). */
  size?: 'md' | 'sm';
  /** A 44 px square, for a lone icon with a visible label elsewhere. */
  square?: boolean;
  wide?: boolean;
  /** Renders the child element (a router link) with the button's look. */
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** The Garis button (garis.css `.btn`): gold keycap, paper, ghost, danger and danger-ghost. */
export function Button({
  variant = 'paper',
  size = 'md',
  square = false,
  wide = false,
  asChild = false,
  className,
  type,
  ...rest
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(
        'g-btn',
        variant,
        size === 'sm' && 'sm',
        square && 'square',
        wide && 'wide',
        className,
      )}
      type={asChild ? undefined : (type ?? 'button')}
      {...rest}
    />
  );
}

export interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  /** Inside running text: no extended hit area, so it doesn't overlap the words around it. */
  inText?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** A text action in the accent colour (garis.css `.link`), such as "Lihat semua". */
export function LinkButton({
  asChild = false,
  inText = false,
  className,
  type,
  ...rest
}: LinkButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn('g-link', inText && 'in-text', className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...rest}
    />
  );
}
