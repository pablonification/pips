import { Slot } from '@radix-ui/react-slot';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  Ref,
} from 'react';
import { cn } from '~/lib/utils';

/** A list whose rows are separated by hairlines (garis.css `.ruled-list`). */
export function RuledList({
  className,
  ...rest
}: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('g-ruled-list', className)} {...rest} />;
}

/** A list row's content: icon or tile, then text, then whatever ends the row (garis.css `.item`). */
export function Item({
  center = false,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { center?: boolean }) {
  return (
    <div className={cn('g-item', center && 'center', className)} {...rest} />
  );
}

export interface RowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The row for the page that is open (desktop split views). */
  current?: boolean;
  /** Renders the child (a router link) as the row. */
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** A whole list row that acts (garis.css `.row-btn`); in a RuledList it gets the hover band. */
export function RowButton({
  current,
  asChild = false,
  className,
  type,
  ...rest
}: RowButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn('g-row-btn', className)}
      aria-current={current ? 'true' : undefined}
      type={asChild ? undefined : (type ?? 'button')}
      {...rest}
    />
  );
}

export interface SectionHeadProps {
  title: ReactNode;
  /** The section's link or action, at the end. */
  action?: ReactNode;
  /** A hairline from the title to the edge (garis.css `.sec-line`, phone Beranda). */
  line?: boolean;
  /** The heading level; sections inside a page are h2 by default. */
  level?: 2 | 3 | 4;
  id?: string;
  className?: string;
}

/** A section's title with its link (garis.css `.sec-head`, or `.sec-line` with the hairline). */
export function SectionHead({
  title,
  action,
  line = false,
  level = 2,
  id,
  className,
}: SectionHeadProps) {
  const H = `h${level}` as const;
  return (
    <div className={cn(line ? 'g-sec-line' : 'g-sec-head', className)}>
      <H className="t-heading" id={id}>
        {title}
      </H>
      {line ? <span className="rule" aria-hidden="true" /> : null}
      {action}
    </div>
  );
}
