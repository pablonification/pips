import * as RD from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { IconTutup } from '~/components/icons/tutup';
import { cn } from '~/lib/utils';
import { Button } from './Button';
import { takeMenuOpener } from './menu-opener';
import { IconButton } from './IconButton';
import { common } from '~/copy/common';
import { DESKTOP_QUERY, useMediaQuery } from './useMediaQuery';

export interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: the overlay's heading and accessible name. */
  title: ReactNode;
  /** Read out with the title; leave out when the content speaks for itself. */
  description?: ReactNode;
  children?: ReactNode;
  /** Actions at the end (garis.css `.ov-foot`), main action last. */
  footer?: ReactNode;
  /** A narrower dialog (420 px) for short confirmations. */
  small?: boolean;
  /** "alertdialog" for a confirmation the member must answer. */
  role?: 'dialog' | 'alertdialog';
  /** Where focus goes when it opens (default: the first focusable element). */
  onOpenAutoFocus?: (e: Event) => void;
  className?: string;
  closeLabel?: string;
}

function Head({ title, closeLabel }: { title: ReactNode; closeLabel: string }) {
  return (
    <div className="g-ov-head">
      <RD.Title asChild>
        <h2>{title}</h2>
      </RD.Title>
      <RD.Close asChild>
        <IconButton label={closeLabel}>
          <IconTutup size={20} />
        </IconButton>
      </RD.Close>
    </div>
  );
}

function Shell({
  kind,
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  small,
  role = 'dialog',
  onOpenAutoFocus,
  className,
  closeLabel = common.actions.tutup,
}: OverlayProps & { kind: 'sheet' | 'dialog' }) {
  // Radix returns focus only to its own Trigger; screens open overlays from their own buttons, so remember what had
  // focus when it opened and go back there when it closes (SPEC: dialogs restore focus).
  const returnTo = useRef<HTMLElement | null>(null);
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className={cn('g-ov', kind === 'dialog' && 'dialog')} />
        <RD.Content
          className={cn(
            kind === 'sheet' ? 'g-sheet' : cn('g-dlg', small && 'sm'),
            className,
          )}
          role={role}
          onOpenAutoFocus={(e) => {
            const active =
              document.activeElement instanceof HTMLElement &&
              document.activeElement !== document.body
                ? document.activeElement
                : null;
            // Opened from a menu item: the menu closes and the item goes, so return to the menu's button.
            const menuOpener = takeMenuOpener();
            returnTo.current =
              !active || active.closest('[role="menu"]')
                ? (menuOpener ?? active)
                : active;
            onOpenAutoFocus?.(e);
          }}
          onCloseAutoFocus={(e) => {
            const el = returnTo.current;
            returnTo.current = null;
            if (el && el.isConnected) {
              e.preventDefault();
              el.focus();
            }
          }}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          {kind === 'sheet' ? (
            <span className="handle" aria-hidden="true" />
          ) : null}
          <Head title={title} closeLabel={closeLabel} />
          {description ? (
            <RD.Description className="t-sm text-fg-2">
              {description}
            </RD.Description>
          ) : null}
          {children}
          {footer ? <div className="g-ov-foot">{footer}</div> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

/**
 * A centred dialog (garis.css `.dlg`): raised, 560 px (420 small), traps focus, closes on Escape and returns focus to
 * the control that opened it. Use Modal unless the layout is known to be desktop.
 */
export function Dialog(props: OverlayProps) {
  return <Shell kind="dialog" {...props} />;
}

/**
 * The phone bottom sheet (garis.css `.sheet`), which opens as a centred panel on tablets. Same focus behaviour as
 * Dialog.
 */
export function Sheet(props: OverlayProps) {
  return <Shell kind="sheet" {...props} />;
}

/** The prototype's overlay: a sheet on phones and tablets, a dialog on desktop (from 1024 px). */
export function Modal(props: OverlayProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return <Shell kind={desktop ? 'dialog' : 'sheet'} {...props} />;
}

export interface ConfirmProps extends Omit<
  OverlayProps,
  'footer' | 'role' | 'children'
> {
  /** States the consequence, at the step that can't be undone. */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** A destructive action gets the danger button. */
  danger?: boolean;
}

/** A confirmation (role alertdialog): Cancel first, then the action; the cancel button has focus. */
export function ConfirmDialog({
  confirmLabel,
  cancelLabel,
  onConfirm,
  danger = false,
  children,
  ...rest
}: ConfirmProps) {
  return (
    <Modal
      {...rest}
      small
      role="alertdialog"
      footer={
        <>
          <RD.Close asChild>
            <Button variant="paper" data-autofocus>
              {cancelLabel}
            </Button>
          </RD.Close>
          <Button variant={danger ? 'danger' : 'gold'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
      onOpenAutoFocus={(e) => {
        const target = (
          e.currentTarget as HTMLElement | null
        )?.querySelector<HTMLElement>('[data-autofocus]');
        if (target) {
          e.preventDefault();
          target.focus();
        }
      }}
    >
      {children ? <div className="t-sm text-fg-2">{children}</div> : null}
    </Modal>
  );
}
