import * as RP from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';

export interface PopoverProps {
  /** The control that opens it (rendered as is: pass a Button or IconButton). */
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** The popover's name, when its content has no heading. */
  label?: string;
  className?: string;
}

/** A raised popover (garis.css `.picker`/`.menu` surface): Escape and outside clicks close it, focus returns. */
export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  side = 'bottom',
  align = 'end',
  label,
  className,
}: PopoverProps) {
  return (
    <RP.Root open={open} onOpenChange={onOpenChange}>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content
          className={cn('g-popover', className)}
          side={side}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          aria-label={label}
        >
          {children}
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
