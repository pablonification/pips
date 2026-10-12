import type { HTMLAttributes, ReactNode } from 'react';
import { IconCentang } from '~/components/icons/centang';
import { IconForm } from '~/components/icons/form';
import { IconJam } from '~/components/icons/jam';
import { cn } from '~/lib/utils';
import { GARIS_STRINGS } from './strings';

export type TagTone =
  'default' | 'accent' | 'success' | 'danger' | 'inverse' | 'outlined';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
  /** A 16 px icon before the word. A status always has one (icon + word + colour). */
  icon?: ReactNode;
}

/** A static label (garis.css `.tag`): 24 px, Geist 12 px, sentence case. Use only when it adds something. */
export function Tag({
  tone = 'default',
  icon,
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={cn('g-tag', tone !== 'default' && tone, className)}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

export type FormStatus = 'open' | 'soon' | 'done';

/** A form's status, always icon + word + colour: Isi sekarang, Belum dibuka, Sudah diisi (garis/ui.js `statusTag`). */
export function StatusTag({
  status,
  className,
}: {
  status: FormStatus;
  className?: string;
}) {
  if (status === 'done')
    return (
      <Tag
        tone="success"
        icon={<IconCentang size={16} />}
        className={className}
      >
        {GARIS_STRINGS.statusDone}
      </Tag>
    );
  if (status === 'soon')
    return (
      <Tag icon={<IconJam size={16} />} className={className}>
        {GARIS_STRINGS.statusSoon}
      </Tag>
    );
  return (
    <Tag tone="accent" icon={<IconForm size={16} />} className={className}>
      {GARIS_STRINGS.statusOpen}
    </Tag>
  );
}

/** A count badge (garis.css `.count`): selected colours, tabular figures. Counts live in navigation. */
export function Count({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  /** What screen readers hear instead of the bare figure ("3 belum dibaca"). */
  label?: string;
}) {
  // A label on a plain span isn't read (ARIA forbids naming a generic element), so it is hidden text instead.
  return (
    <span className={cn('g-count', className)}>
      {label ? (
        <>
          <span aria-hidden="true">{value}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        value
      )}
    </span>
  );
}
