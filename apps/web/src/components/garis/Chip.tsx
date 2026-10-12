import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  Ref,
} from 'react';
import { cn } from '~/lib/utils';

export interface ChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange'
> {
  /** A toggle filter: pressed shows the selected (inverse) fill. */
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  /** A count after the label, only when it adds something. */
  count?: number;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** An interactive filter (garis.css `.chip`): bordered; pressed, it becomes an inverse block. */
export function Chip({
  pressed,
  onPressedChange,
  count,
  icon,
  className,
  children,
  onClick,
  type,
  ...rest
}: ChipProps) {
  return (
    <button
      className={cn('g-chip', className)}
      aria-pressed={pressed}
      type={type ?? 'button'}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onPressedChange?.(!pressed);
      }}
      {...rest}
    >
      {icon}
      {children}
      {count !== undefined ? <span className="n">{count}</span> : null}
    </button>
  );
}

/** A row of chips that scrolls sideways on a phone (garis.css `.chips`). */
export function Chips({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('g-chips', className)} {...rest} />;
}
