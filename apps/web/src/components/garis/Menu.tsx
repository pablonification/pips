import * as DM from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';

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
  /** Shown but not available; give the reason as a hint. */
  disabled?: boolean;
}

export function MenuItem({
  children,
  onSelect,
  icon,
  hint,
  danger = false,
  disabled = false,
}: MenuItemProps) {
  return (
    <DM.Item
      className={danger ? 'danger' : undefined}
      onSelect={onSelect}
      disabled={disabled}
    >
      {icon}
      <span>
        {children}
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
    </DM.Item>
  );
}
