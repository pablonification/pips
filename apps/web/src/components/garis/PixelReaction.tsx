import { cn } from '~/lib/utils';
import {
  PIXEL_REACTION_LABELS,
  pixelRuns,
  type PixelReactionKey,
} from './pixel-art';

export interface PixelReactionProps {
  reaction: PixelReactionKey;
  /** Size in px (the art is 10 × 10, drawn crisp at any size). */
  size?: number;
  /** Names the reaction for screen readers; by default it is decorative (a nearby label or count names it). */
  labelled?: boolean;
  className?: string;
}

/** One of PIPS!'s six reactions as 10 × 10 pixel art. The rim turns bronze in dark mode. */
export function PixelReaction({
  reaction,
  size = 20,
  labelled = false,
  className,
}: PixelReactionProps) {
  return (
    <svg
      className={cn('g-px', className)}
      width={size}
      height={size}
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? PIXEL_REACTION_LABELS[reaction] : undefined}
      focusable="false"
    >
      {pixelRuns(reaction).map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          className={r.colour}
          x={r.x}
          y={r.y}
          width={r.width}
          height={1}
        />
      ))}
    </svg>
  );
}
