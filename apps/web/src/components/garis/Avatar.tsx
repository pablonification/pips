import { useState, type ButtonHTMLAttributes, type Ref } from 'react';
import { useDataSettled } from '~/lib/data-settled';
import { cn } from '~/lib/utils';

interface AvatarProps {
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
 * A person's photo over their initials: the initials show until the page has settled and the photo loads, and stay
 * if it fails. Put it inside any `.g-avatar` (a span, a button, or the shell's link to Profil).
 */
export function AvatarPhoto({ picture }: { picture?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  // Decorative: it waits until the page's own data has arrived (useDataSettled).
  const settled = useDataSettled();
  const photo = settled && picture && picture !== failed ? picture : null;
  if (!photo) return null;
  return (
    <img
      className="g-avatar-photo"
      src={photo}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(photo)}
    />
  );
}

/**
 * A person's initials, or their photo when there is one and it loads. Decorative: the name is
 * always written next to it.
 */
export function Avatar({
  initials,
  picture,
  shape = 'round',
  size = 'md',
  className,
}: AvatarProps) {
  return (
    <span className={classes(shape, size, className)} aria-hidden="true">
      {initials}
      <AvatarPhoto picture={picture} />
    </span>
  );
}

interface AvatarButtonProps
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
  picture,
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
      <AvatarPhoto picture={picture} />
    </button>
  );
}
