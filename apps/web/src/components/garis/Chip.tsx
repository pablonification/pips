import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { IconCentang } from '~/components/icons/centang';
import { cn } from '~/lib/utils';

export type ChipKind = 'toggle' | 'checkbox';

interface ChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role'
> {
  /**
   * How the chip is read:
   * - `toggle` (default): a filter that is on or off (`aria-pressed`), like "Belum dibaca";
   * - `checkbox`: one of several choices (`role="checkbox"`), like the composer's categories; it shows a check.
   */
  kind?: ChipKind;
  /** On: the selected (inverse) fill. */
  selected: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** A count after the label, only when it adds something. */
  count?: number;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** An interactive chip: bordered; selected, it becomes an inverse block. */
export function Chip({
  kind = 'toggle',
  selected,
  onSelectedChange,
  count,
  icon,
  className,
  children,
  onClick,
  type,
  ...rest
}: ChipProps) {
  const state =
    kind === 'toggle'
      ? { 'aria-pressed': selected }
      : { role: kind, 'aria-checked': selected };
  return (
    <button
      className={cn('g-chip', className)}
      type={type ?? 'button'}
      {...state}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onSelectedChange?.(!selected);
      }}
      {...rest}
    >
      {kind === 'checkbox' && selected ? <IconCentang size={16} /> : icon}
      {children}
      {count !== undefined ? <span className="n">{count}</span> : null}
    </button>
  );
}

interface ChipsProps extends HTMLAttributes<HTMLDivElement> {
  /** Wrap onto more lines instead of scrolling sideways. */
  wrap?: boolean;
  /** Names the group when its chips are checkboxes ("Pilih angkatan"); the row becomes `role="group"`. */
  label?: string;
}

/** A row of chips: scrolls sideways on a phone, or wraps in a form. */
export function Chips({ wrap = false, label, className, ...rest }: ChipsProps) {
  return (
    <div
      className={cn(wrap ? 'g-ck-chips' : 'g-chips', className)}
      {...(label ? { role: 'group', 'aria-label': label } : {})}
      {...rest}
    />
  );
}
