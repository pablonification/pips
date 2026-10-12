import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '~/lib/utils';

export interface AvatarProps {
  /** One or two letters. */
  initials: string;
  /** round: other people (muted); square: you (gold keycap, as in the top bar and sidebar). */
  shape?: 'round' | 'square';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const classes = (
  shape: AvatarProps['shape'],
  size: AvatarProps['size'],
  className?: string,
) =>
  cn(
    'g-avatar',
    shape === 'round' && 'round',
    size === 'sm' && 'sm',
    size === 'lg' && 'lg',
    className,
  );

/** A person's initials (garis.css `.avatar`). Decorative: the name is always written next to it. */
export function Avatar({
  initials,
  shape = 'round',
  size = 'md',
  className,
}: AvatarProps) {
  return (
    <span className={classes(shape, size, className)} aria-hidden="true">
      {initials}
    </span>
  );
}

export interface AvatarButtonProps
  extends
    AvatarProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-label'> {
  /** The button's name, for example "Profil". */
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Your avatar as a button (it opens Profil); 44 px hit area on touch. */
export function AvatarButton({
  initials,
  shape = 'square',
  size = 'md',
  className,
  label,
  type,
  ...rest
}: AvatarButtonProps) {
  return (
    <button
      className={classes(shape, size, className)}
      aria-label={label}
      type={type ?? 'button'}
      {...rest}
    >
      <span aria-hidden="true">{initials}</span>
    </button>
  );
}
