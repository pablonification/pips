import * as DM from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { rememberMenuOpener } from './menu-opener';

export interface MenuProps {
  /** The button that opens it (rendered as is). */
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/** An action menu (garis.css `.menu`): arrow keys move, Enter acts, Escape closes and returns focus. */
export function Menu({
  trigger,
  children,
  open,
  onOpenChange,
  align = 'end',
  className,
}: MenuProps) {
  return (
    <DM.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content
          className={cn('g-menu', className)}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          // Radix focuses the item under the pointer, which the browser may show as keyboard focus: note how the
          // member is moving, so the ring is drawn for the keyboard only (garis.css shows hover as a fill).
          onPointerMove={(e) => {
            e.currentTarget.dataset.input = 'pointer';
          }}
          onKeyDown={(e) => {
            e.currentTarget.dataset.input = 'keyboard';
          }}
        >
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  /** A short reason or detail under the label ("Bisa lagi mulai 15.30"). */
  hint?: ReactNode;
  danger?: boolean;
  /**
   * Shown but not available now, as in the prototype's "Umumkan ulang": the item stays reachable by keyboard and is
   * announced as unavailable (`aria-disabled`), give the reason as a hint. Choosing it keeps the menu open and still
   * calls onSelect, so the screen can explain why (the prototype shows a toast).
   */
  disabled?: boolean;
  /**
   * No icon of its own, but its label lines up with the items that have one: the icon's column is kept empty, as in
   * the prototype's `menuList`, where every item has an icon.
   */
  inset?: boolean;
}

export function MenuItem({
  children,
  onSelect,
  icon,
  hint,
  danger = false,
  disabled = false,
  inset = false,
}: MenuItemProps) {
  return (
    <DM.Item
      className={danger ? 'danger' : undefined}
      aria-disabled={disabled || undefined}
      onSelect={(e) => {
        if (disabled) e.preventDefault();
        else rememberMenuOpener(e.currentTarget as Element | null);
        onSelect?.();
      }}
    >
      {icon ??
        (inset ? <span aria-hidden="true" className="w-5 shrink-0" /> : null)}
      <span>
        {children}
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
    </DM.Item>
  );
}
