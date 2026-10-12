import { cn } from '~/lib/utils';

/**
 * The app's wordmark: PIPS! set wide (Archivo Expanded), the exclamation mark drawn as a bar and a square
 * (garis/ui.js `wordmark()`). Screen readers hear "PIPS!".
 */
export function Wordmark({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn('g-wordmark disp', className)}
      style={{ fontSize: size }}
    >
      PIPS
      <span className="g-bang" aria-hidden="true">
        <i />
        <b />
      </span>
      <span className="sr-only">!</span>
    </span>
  );
}
