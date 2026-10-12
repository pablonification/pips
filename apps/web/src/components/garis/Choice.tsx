import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { IconCentang } from '~/components/icons/centang';
import { cn } from '~/lib/utils';

export interface SegOption<V extends string> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
}

export interface SegProps<V extends string> {
  /** The group's name for screen readers ("Tema"). */
  label: string;
  options: SegOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Fills the width, with equal parts. */
  full?: boolean;
  name?: string;
  className?: string;
}

/**
 * The segmented control (garis.css `.seg`): native radio buttons in a muted track, so arrow keys move the choice.
 */
export function Seg<V extends string>({
  label,
  options,
  value,
  onChange,
  full = false,
  name,
  className,
}: SegProps<V>) {
  const auto = useId();
  return (
    <fieldset
      className={cn('g-seg', full && 'full', className)}
      aria-label={label}
    >
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            name={name ?? auto}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.icon}
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role' | 'aria-checked'
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Can't be changed (for example a category HMIF requires); it stays focusable so its reason can be read. */
  locked?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The switch (garis.css `.switch`): a gold track and an ink knob when on. Name it with aria-label or
 * aria-labelledby (the row's title).
 */
export function Switch({
  checked,
  onCheckedChange,
  locked = false,
  className,
  onClick,
  type,
  ...rest
}: SwitchProps) {
  return (
    <button
      type={type ?? 'button'}
      role="switch"
      aria-checked={checked}
      aria-disabled={locked || undefined}
      className={cn('g-switch', className)}
      onClick={(e) => {
        onClick?.(e);
        if (!locked && !e.defaultPrevented) onCheckedChange(!checked);
      }}
      {...rest}
    />
  );
}

export interface OptionProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  children: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** A checkbox row (garis.css `.opt`): the whole row is the target. */
export function Checkbox({ children, className, ...rest }: OptionProps) {
  return (
    <label className={cn('g-opt', className)}>
      <input type="checkbox" {...rest} />
      <span className="box" aria-hidden="true">
        <IconCentang size={16} />
      </span>
      {children}
    </label>
  );
}

/** A radio row (garis.css `.opt.radio`). Group them in Options with the same name. */
export function Radio({ children, className, ...rest }: OptionProps) {
  return (
    <label className={cn('g-opt radio', className)}>
      <input type="radio" {...rest} />
      <span className="box" aria-hidden="true" />
      {children}
    </label>
  );
}

/** A stack of Checkbox or Radio rows (garis.css `.opts`); a radio group is a fieldset with a legend. */
export function Options({
  legend,
  className,
  children,
}: {
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  if (!legend) return <div className={cn('g-opts', className)}>{children}</div>;
  return (
    <fieldset className={cn('g-opts', className)}>
      <legend className="mb-1.5 t-label">{legend}</legend>
      {children}
    </fieldset>
  );
}
