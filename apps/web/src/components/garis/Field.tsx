import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { IconBawah } from '~/components/icons/bawah';
import { IconCari } from '~/components/icons/cari';
import { IconPeringatan } from '~/components/icons/peringatan';
import { cn } from '~/lib/utils';

interface FieldContext {
  id: string;
  describedBy?: string;
  invalid: boolean;
}
const Ctx = createContext<FieldContext | null>(null);

export interface FieldProps {
  label: ReactNode;
  /** A short constraint under the field, only when it prevents a mistake ("8 angka, misalnya 13525045"). */
  hint?: ReactNode;
  /** The error, saying the cause and the fix. Marks the control invalid and is linked to it. */
  error?: ReactNode;
  className?: string;
  /** Exactly one Input, Textarea or Select. */
  children: ReactNode;
}

/**
 * A labelled field (garis.css `.fld`): the label bound to the control, then the hint or the error, which the control
 * names with aria-describedby (SPEC "Accessibility").
 */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const hasNote = Boolean(error || hint);
  return (
    <Ctx.Provider
      value={{
        id,
        describedBy: hasNote ? noteId : undefined,
        invalid: Boolean(error),
      }}
    >
      <div className={cn('g-fld', className)}>
        <label className="t-label" htmlFor={id}>
          {label}
        </label>
        {children}
        {error ? (
          <span className="g-err t-cap" id={noteId}>
            <IconPeringatan size={16} />
            {error}
          </span>
        ) : hint ? (
          <span className="t-cap text-fg-3" id={noteId}>
            {hint}
          </span>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}

function useFieldProps<
  T extends {
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: unknown;
  },
>(props: T) {
  const ctx = useContext(Ctx);
  if (!ctx) return props;
  return {
    ...props,
    id: props.id ?? ctx.id,
    'aria-describedby': props['aria-describedby'] ?? ctx.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (ctx.invalid || undefined),
  };
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input className={cn('g-field', className)} {...useFieldProps(props)} />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea className={cn('g-field', className)} {...useFieldProps(props)} />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <span className="g-select">
      <select className={cn('g-field', className)} {...useFieldProps(props)}>
        {children}
      </select>
      <IconBawah size={16} />
    </span>
  );
}

export interface SearchboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** The field's name for screen readers (the placeholder isn't one). */
  label: string;
  ref?: Ref<HTMLInputElement>;
}

/** A search field with its icon (garis.css `.searchbox`). */
export function Searchbox({ label, className, ...rest }: SearchboxProps) {
  return (
    <div className={cn('g-searchbox', className)}>
      <IconCari size={20} />
      <input type="search" aria-label={label} autoComplete="off" {...rest} />
    </div>
  );
}
