import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type Ref,
} from 'react';
import type { FormManageStatus } from '~/api/generated';
import { Button, LinkButton, Tag, toast } from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconJam } from '~/components/icons/jam';
import { IconKredit } from '~/components/icons/kredit';
import { IconKunci } from '~/components/icons/kunci';
import { IconPegang } from '~/components/icons/pegang';
import { IconSalin } from '~/components/icons/salin';
import { IconTautan } from '~/components/icons/tautan';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { cn } from '~/lib/utils';
import { SHORT_HOST as LINK_HOST, shortUrl as linkOf } from '~/lib/short-name';

/** A form's state for whoever manages it: icon, word and colour. */
export function MakerStatus({ status }: { status: FormManageStatus }) {
  if (status === 'open')
    return (
      <Tag tone="success" icon={<IconCentang size={16} />}>
        {copy.status.dibuka}
      </Tag>
    );
  if (status === 'scheduled')
    return (
      <Tag tone="accent" icon={<IconJam size={16} />}>
        {copy.status.dijadwalkan}
      </Tag>
    );
  if (status === 'closed')
    return <Tag icon={<IconKunci size={16} />}>{copy.status.ditutup}</Tag>;
  return (
    <Tag tone="outlined" icon={<IconKredit size={16} />}>
      {copy.status.draf}
    </Tag>
  );
}

/** The handle a question, an option or an outline row is moved by. */
export function Grip({
  label,
  lifted,
  size = 20,
  className,
  ref,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  lifted?: boolean;
  size?: 16 | 20;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn('fb-grip', className)}
      {...rest}
      aria-label={label}
      aria-pressed={!!lifted}
    >
      <IconPegang size={size} />
    </button>
  );
}

/** The form's address on its plate; "Ubah" for those who may rename it. */
export function LinkBox({
  slug,
  onEdit,
  editRef,
}: {
  slug: string;
  onEdit?: () => void;
  editRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="fb-lk-box">
      <IconTautan size={20} />
      <p className="fb-lk-url">
        <span>{LINK_HOST}</span>
        <b>{slug}</b>
      </p>
      {onEdit ? (
        <LinkButton
          ref={editRef}
          onClick={onEdit}
          aria-label={copy.tautan.ubahNama}
        >
          {copy.tautan.ubah}
        </LinkButton>
      ) : null}
    </div>
  );
}

/** Puts the address on the clipboard; false when the browser refused. */
export async function copyLink(slug: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(linkOf(slug));
    return true;
  } catch {
    return false;
  }
}

/**
 * "Salin tautan": the button itself reads "Tautan disalin" with a tick for a moment, and a screen reader hears it
 * (its name changes in place, inside a live region).
 */
export function CopyButton({
  slug,
  variant = 'paper',
  size = 'sm',
  autoFocus,
}: {
  slug: string;
  variant?: 'paper' | 'gold';
  size?: 'sm' | 'md';
  autoFocus?: boolean;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <span aria-live="polite">
      <Button
        variant={variant}
        size={size}
        className={cn('fb-copy', size === 'sm' && 'sm')}
        autoFocus={autoFocus}
        data-autofocus={autoFocus || undefined}
        onClick={async () => {
          if (!(await copyLink(slug))) {
            toast.error(copy.tautan.gagalSalin);
            return;
          }
          setDone(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 2400);
        }}
      >
        {done ? <IconCentang size={16} /> : <IconSalin size={16} />}
        {done ? copy.tautan.disalin : copy.tautan.salin}
      </Button>
    </span>
  );
}
