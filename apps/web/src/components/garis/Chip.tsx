import {
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { IconCentang } from '~/components/icons/centang';
import { cn } from '~/lib/utils';

export type ChipKind = 'toggle' | 'checkbox' | 'radio';

export interface ChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role'
> {
  /**
   * How the chip is read, as in the prototype:
   * - `toggle` (default): a filter that is on or off (`aria-pressed`), like "Belum dibaca";
   * - `checkbox`: one of several choices (`role="checkbox"`), like the composer's categories; it shows a check;
   * - `radio`: one choice of a group (`role="radio"`), only inside ChipGroup, like the class picker.
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

/** An interactive chip (garis.css `.chip`): bordered; selected, it becomes an inverse block. */
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

export interface ChipsProps extends HTMLAttributes<HTMLDivElement> {
  /** Wrap onto more lines (garis.css `.ck-chips`, for checkbox chips in a form) instead of scrolling sideways. */
  wrap?: boolean;
  /** Names the group when its chips are checkboxes ("Pilih angkatan"); the row becomes `role="group"`. */
  label?: string;
}

/** A row of chips: scrolls sideways on a phone (garis.css `.chips`), or wraps in a form (`.ck-chips`). */
export function Chips({ wrap = false, label, className, ...rest }: ChipsProps) {
  return (
    <div
      className={cn(wrap ? 'g-ck-chips' : 'g-chips', className)}
      {...(label ? { role: 'group', 'aria-label': label } : {})}
      {...rest}
    />
  );
}

export interface ChipGroupOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

export interface ChipGroupProps<T extends string | number> {
  /** The group's name ("Kelas IF2110"). */
  label: string;
  options: ChipGroupOption<T>[];
  /** The chosen value; null when none is chosen yet. */
  value: T | null;
  onChange: (value: T | null) => void;
  /** Choosing the chosen chip again clears it, as the prototype's class picker does. */
  deselectable?: boolean;
  className?: string;
}

const NEXT: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * Chips as a radio group (the prototype's class picker, garis.css `.kpick`): one tab stop, the arrow keys move and
 * choose, Home and End go to the ends.
 */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  deselectable = false,
  className,
}: ChipGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = options.findIndex((o) => o.value === value);
  const tabStop = chosen === -1 ? 0 : chosen;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const at = refs.current.findIndex((el) => el === document.activeElement);
    if (at === -1) return;
    let to: number;
    if (e.key in NEXT)
      to = (at + NEXT[e.key] + options.length) % options.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = options.length - 1;
    else return;
    e.preventDefault();
    refs.current[to]?.focus();
    onChange(options[to].value);
  }

  return (
    <div
      className={cn('g-chip-group', className)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => (
        <Chip
          key={String(o.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          kind="radio"
          selected={i === chosen}
          tabIndex={i === tabStop ? 0 : -1}
          onSelectedChange={() =>
            onChange(i === chosen && deselectable ? null : o.value)
          }
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
