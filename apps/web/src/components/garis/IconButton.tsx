import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '~/lib/utils';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  /** Required: the button's Indonesian name, since it shows only an icon (SPEC "Components enforce names"). */
  label: string;
  children: ReactNode;
  /** 40 px by default, 34 px small; on touch layouts both get a 44 px hit area. */
  size?: 'md' | 'sm';
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** A button that shows only an icon (garis.css `.icon-btn`). */
export function IconButton({
  label,
  size = 'md',
  asChild = false,
  className,
  children,
  type,
  ...rest
}: IconButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn('g-icon-btn', size === 'sm' && 'sm', className)}
      aria-label={label}
      type={asChild ? undefined : (type ?? 'button')}
      {...rest}
    >
      {children}
    </Comp>
  );
}
