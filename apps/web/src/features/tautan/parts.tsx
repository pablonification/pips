import { Link } from '@tanstack/react-router';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  Button,
  IconButton,
  LinkButton,
  RowButton,
  Tag,
  Tile,
  toast,
} from '~/components/garis';
import { IconBagikan } from '~/components/icons/bagikan';
import { IconCentang } from '~/components/icons/centang';
import { IconForm } from '~/components/icons/form';
import { IconJam } from '~/components/icons/jam';
import { IconPendek } from '~/components/icons/pendek';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconSalin } from '~/components/icons/salin';
import { fill } from '~/copy/fill';
import { namaPendek } from '~/copy/nama-pendek';
import { tautan as copy } from '~/copy/tautan';
import {
  SHORT_HOST,
  nameMessage,
  nameProblem,
  shortUrl,
  tidyName,
  type NameRefusal,
} from '~/lib/short-name';
import { cn } from '~/lib/utils';
import { checkName, type AdminSummary, type Summary } from './queries';
import { bareUrl } from './rules';

/** "s.hmif.dev/" muted, then the name. */
export function Address({ name }: { name: string }) {
  return (
    <>
      <span>{SHORT_HOST}</span>
      <b>{name}</b>
    </>
  );
}

/** The address on its plate, with Ubah for whoever may rename it. */
export function AddressBox({
  name,
  onEdit,
  editRef,
}: {
  name: string;
  onEdit?: () => void;
  editRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="sl-box sl-big">
      <IconPendek size={20} />
      <p className="sl-url">
        <Address name={name} />
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

async function toClipboard(name: string) {
  try {
    await navigator.clipboard.writeText(shortUrl(name));
    return true;
  } catch {
    return false;
  }
}

/**
 * "Salin tautan": the button itself reads "Tautan disalin" with a tick for a moment, and a screen reader hears it (its
 * name changes in place, inside a live region).
 */
export function CopyButton({
  name,
  variant = 'paper',
  size = 'sm',
  autoFocus,
}: {
  name: string;
  variant?: 'paper' | 'gold';
  size?: 'sm' | 'md';
  autoFocus?: boolean;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <span aria-live="polite" className="contents">
      <Button
        variant={variant}
        size={size}
        className={cn('sl-copybtn', size === 'sm' && 'sm', done && 'done')}
        autoFocus={autoFocus}
        data-autofocus={autoFocus || undefined}
        onClick={async () => {
          if (!(await toClipboard(name))) {
            toast.error(copy.salin.gagal);
            return;
          }
          setDone(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 2400);
        }}
      >
        {done ? <IconCentang size={16} /> : <IconSalin size={16} />}
        {done ? copy.salin.disalin : copy.salin.salin}
      </Button>
    </span>
  );
}

/** "Bagikan lewat…": the device's own share sheet, where there is one. */
export function ShareSheetButton({ name }: { name: string }) {
  if (typeof navigator === 'undefined' || !('share' in navigator)) return null;
  return (
    <Button
      variant="paper"
      size="sm"
      onClick={() => {
        navigator.share({ url: shortUrl(name) }).catch(() => {});
      }}
    >
      <IconBagikan size={16} />
      {copy.salin.bagikanLewat}
    </Button>
  );
}

/** A row's copy button: a tick for a moment, and the toast says it. */
function RowCopy({ name }: { name: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <IconButton
      className={cn('sl-copy', done && 'done')}
      label={fill(copy.daftar.salinNama, { nama: name })}
      onClick={async () => {
        if (!(await toClipboard(name))) {
          toast.error(copy.salin.gagal);
          return;
        }
        toast.success(copy.salin.disalinToast);
        setDone(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <IconCentang size={20} /> : <IconSalin size={20} />}
    </IconButton>
  );
}

/** "Belum diambil": a link of an old account nobody in PIPS! holds yet. */
export function UnclaimedTag() {
  return (
    <Tag tone="accent" icon={<IconJam size={16} />}>
      {copy.kelola.belumDiambil}
    </Tag>
  );
}

/**
 * One link in a list: its address, where it goes (or "Form" and the form's title), the clicks, and a copy button.
 * Admin's rows also say who holds it, or that nobody has taken it and from which old account.
 */
export function LinkRow({
  link,
  to,
  fresh,
  admin,
}: {
  link: Summary | AdminSummary;
  to: { to: '/layanan/tautan/$id' | '/kelola/tautan/$id'; id: string };
  fresh?: boolean;
  admin?: boolean;
}) {
  const a = admin ? (link as AdminSummary) : null;
  return (
    <li className={cn('sl-row', fresh && 'sl-new')}>
      <RowButton asChild className="sl-main">
        <Link to={to.to} params={{ id: to.id }}>
          <span className="sl-txt">
            <span className="sl-addr block">
              <Address name={link.name} />
            </span>
            {link.form ? (
              <span className="sl-formsub t-cap text-fg-2">
                <Tag icon={<IconForm size={16} />}>{copy.daftar.form}</Tag>
                <span className="sl-ell">{link.form.title}</span>
              </span>
            ) : (
              <span className="sl-ell t-cap text-fg-2">
                {bareUrl(link.destination ?? '')}
              </span>
            )}
            {a ? (
              <span className="sl-own t-cap">
                {a.owner ? (
                  <span className="text-fg-2">{a.owner.fullName}</span>
                ) : (
                  <>
                    <UnclaimedTag />
                    <span className="text-fg-3">{a.oldAccount}</span>
                  </>
                )}
              </span>
            ) : null}
          </span>
          <span className="sl-n">
            <b>{link.clicks.toLocaleString('id-ID')}</b>
            <span>{copy.daftar.klik}</span>
          </span>
        </Link>
      </RowButton>
      <RowCopy name={link.name} />
    </li>
  );
}

/** One of a page's states: an icon tile, what happened, what to do. */
export function SlState({
  icon,
  title,
  text,
  gold,
  done,
  titleRef,
  children,
}: {
  icon: ReactNode;
  title: string;
  text?: ReactNode;
  /** The gold tile of a finished claim, which pops in. */
  gold?: boolean;
  done?: boolean;
  titleRef?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}) {
  return (
    <div className={cn('sl-state', done && 'sl-done')}>
      <Tile gold={gold}>{icon}</Tile>
      <h2 className="t-title" ref={titleRef} tabIndex={-1}>
        {title}
      </h2>
      {text ? <p className="t-sm text-fg-2 num">{text}</p> : null}
      {children ? <div className="sl-state-acts">{children}</div> : null}
    </div>
  );
}

export type NameStatus = {
  refusal: NameRefusal | null;
  checking: boolean;
  /** The server said it is free. */
  free: boolean;
};

/**
 * A name's status while it is typed: the rule at once, then whether something holds it about 300 ms after the last
 * key (saving still decides). `optional`: an empty name is fine (a random one). `current`: the link's own name, which
 * needs no check.
 */
export function useNameStatus(
  name: string,
  {
    optional,
    current,
    linkId,
  }: {
    optional?: boolean;
    current?: string;
    linkId?: string;
  },
): [NameStatus, (s: NameStatus) => void] {
  const [status, setStatus] = useState<NameStatus>({
    refusal: null,
    checking: false,
    free: false,
  });
  useEffect(() => {
    if (current !== undefined && name === current)
      return setStatus({ refusal: null, checking: false, free: false });
    if (!name)
      return setStatus({
        refusal: null,
        checking: false,
        free: false,
      });
    const local = nameProblem(name);
    if (local)
      return setStatus({
        refusal: { problem: local },
        checking: false,
        free: false,
      });
    setStatus({ refusal: null, checking: true, free: false });
    let live = true;
    const t = setTimeout(() => {
      checkName(name, linkId)
        .then((r) => {
          if (!live || r.name !== name) return;
          setStatus({
            refusal: r.available
              ? null
              : {
                  problem: r.problem ?? 'taken',
                  heldAs: r.heldAs,
                  heldBy: r.heldBy,
                },
            checking: false,
            free: r.available,
          });
        })
        .catch(() => {
          if (live) setStatus({ refusal: null, checking: false, free: false });
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, current, linkId, optional]);
  return [status, setStatus];
}

/** The status line under a name field: icon, words and colour. */
export function NameStatusLine({
  id,
  status,
  name,
  empty,
}: {
  id: string;
  status: NameStatus;
  name: string;
  /** Said when the name is empty and one is needed (renaming). */
  empty?: boolean;
}) {
  return (
    <p className="sl-st" id={id} role="status">
      {empty ? (
        <span className="no">
          <IconPeringatan size={16} />
          {namaPendek.tulis}
        </span>
      ) : status.checking ? (
        <span className="wait">{namaPendek.memeriksa}</span>
      ) : status.refusal ? (
        <span className="no">
          <IconPeringatan size={16} />
          {nameMessage(status.refusal, name)}
        </span>
      ) : status.free ? (
        <span className="ok">
          <IconCentang size={16} />
          {namaPendek.tersedia}
        </span>
      ) : null}
    </p>
  );
}

/** "s.hmif.dev/" fixed, then the name written on a line; spaces become hyphens as they are typed. */
export function NameInput({
  value,
  onChange,
  labelledBy,
  describedBy,
  invalid,
  inputRef,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  labelledBy: string;
  describedBy: string;
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const pre = useId();
  return (
    <label className="sl-field">
      <span className="sl-pre" id={pre}>
        {SHORT_HOST}
      </span>
      <input
        ref={inputRef}
        className="sl-lf"
        type="text"
        value={value}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-labelledby={`${labelledBy} ${pre}`}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          const el = e.target;
          const pos = el.selectionStart;
          const tidy = tidyName(el.value);
          onChange(tidy);
          if (tidy !== el.value)
            requestAnimationFrame(() => el.setSelectionRange(pos, pos));
        }}
      />
    </label>
  );
}

/** A destination field's error under it. */
export function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p className="sl-err t-sm" id={id}>
      <IconPeringatan size={16} />
      {children}
    </p>
  );
}
