import { cn } from '~/lib/utils';

/** The official file's size: never stretched, so the height always follows from the width. */
const HMIF_LOGO_SRC = '/logo/hmif.png';
const HMIF_LOGO_RATIO = 533 / 800;
const HMIF_LOGO_MIN_WIDTH = 40;

interface HmifLogoProps {
  /** Width in px, at least 40. The sidebar uses 54, the member card 72. */
  width: number;
  /** Alternative text; leave empty when a nearby word already names HMIF. */
  alt?: string;
  /** Sits on an ink plate, for gold backgrounds (the member card), so the logo keeps its edge. */
  plate?: boolean;
  className?: string;
}

/**
 * HMIF ITB's logo: always the official file, whole. Never redraw, crop, recolour, stretch, outline or cover it.
 * This component is the only way the app shows it.
 */
export function HmifLogo({
  width,
  alt = '',
  plate = false,
  className,
}: HmifLogoProps) {
  const w = Math.max(HMIF_LOGO_MIN_WIDTH, Math.round(width));
  const img = (
    <img
      className={cn('g-hmif-logo', !plate && className)}
      src={HMIF_LOGO_SRC}
      width={w}
      height={Math.round(w * HMIF_LOGO_RATIO)}
      alt={alt}
      decoding="async"
    />
  );
  return plate ? (
    <span className={cn('g-logo-plate', className)}>{img}</span>
  ) : (
    img
  );
}
