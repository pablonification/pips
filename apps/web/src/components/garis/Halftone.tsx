import { useId } from 'react';
import { cn } from '~/lib/utils';
import { halftoneSquares } from './halftone-geometry';

export interface HalftoneProps {
  /** How far the squares grow, in px (the phone header uses 216). */
  length?: number;
  /** The grid, in px. */
  cell?: number;
  className?: string;
}

/**
 * Beranda's header pattern: tonal squares that grow toward the right edge, in `--hero-tone` (ink at 13 % in light
 * mode, gold at 18 % in dark). Built like the pixel reactions; it never draws HMIF's logo. Fills its box.
 */
export function Halftone({ length = 216, cell = 8, className }: HalftoneProps) {
  const id = `ht${useId().replace(/:/g, '')}`;
  const n = Math.round(length / cell);
  return (
    <span className={cn('g-halftone', className)} aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        fill="currentColor"
        shapeRendering="crispEdges"
        focusable="false"
      >
        <defs>
          <pattern
            id={id}
            width={n * cell}
            height={cell}
            patternUnits="userSpaceOnUse"
          >
            {halftoneSquares(length, cell).map((s) => (
              <rect key={s.x} x={s.x} y={s.y} width={s.size} height={s.size} />
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </span>
  );
}
