import { useState, type ButtonHTMLAttributes, type Ref } from 'react';
import { cn } from '~/lib/utils';

export interface AvatarProps {
  /** One or two letters. */
  initials: string;
  /** The person's photo, when they have one: it covers the initials once it loads, and they stay if it fails. */
  picture?: string | null;
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

/**
 * A person's initials (garis.css `.avatar`), or their photo when there is one and it loads. Decorative: the name is
 * always written next to it.
 */
export function Avatar({
  initials,
  picture,
  shape = 'round',
  size = 'md',
  className,
}: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = picture && picture !== failed ? picture : null;
  return (
    <span className={classes(shape, size, className)} aria-hidden="true">
      {initials}
      {photo ? (
        <img
          className="g-avatar-photo"
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(photo)}
        />
      ) : null}
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
