import type { ReactNode, SVGProps } from 'react';
import { cn } from '~/lib/utils';

export interface IconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'children' | 'ref'
> {
  /** 16, 20 or 24 px; other values round up to the next of the three (as the prototype's `ic()` does). */
  size?: number;
  /** Only for an icon that carries meaning on its own; most icons sit next to a word and stay hidden. */
  title?: string;
}

/** The three icon sizes, and the stroke that renders 1.5 px at each (garis/ui.js `ic()`). */
export function iconBox(size = 20) {
  const s = size <= 16 ? 16 : size <= 20 ? 20 : 24;
  return { s, stroke: +((1.5 * 24) / s).toFixed(2) };
}

/** The Garis icon frame: a 24 px grid, `currentColor`, square caps and mitred corners. */
export function GarisIcon({
  size = 20,
  title,
  className,
  children,
  ...rest
}: IconProps & { children: ReactNode }) {
  const { s, stroke } = iconBox(size);
  return (
    <svg
      className={cn('g-ic', `s${s}`, className)}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** The two-tone service glyph frame: always 24 px at a 1.5 px stroke, the gold fill under the line. */
export function GarisGlyph({
  title,
  className,
  children,
  ...rest
}: Omit<IconProps, 'size'> & { children: ReactNode }) {
  return (
    <svg
      className={cn('g-ic s24 glyph', className)}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
