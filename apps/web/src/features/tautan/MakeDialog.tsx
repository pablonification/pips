import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { ApiError, type ShortLinkProblem } from '~/api/generated';
import {
  Button,
  DESKTOP_QUERY,
  Modal,
  toast,
  useMediaQuery,
} from '~/components/garis';
import { tautan as copy } from '~/copy/tautan';
import { cn } from '~/lib/utils';
import {
  AddressBox,
  CopyButton,
  FieldError,
  NameInput,
  NameStatusLine,
  ShareSheetButton,
  useNameStatus,
} from './parts';
import { createLink, refreshAll, type Link } from './queries';
import { destinationProblem, type DestinationProblem } from './rules';

/**
 * "Buat tautan pendek": the destination first, then the short name (empty for a random one), each checked in place;
 * then "Tautan siap" with the address, ready to copy. A sheet on phones and tablets, a dialog on desktop.
 */
export function MakeDialog({
  open,
  onOpenChange,
  onMade,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMade: (id: string) => void;
}) {
  const [made, setMade] = useState<Link | null>(null);
  // A fresh form each time it opens.
  const [round, setRound] = useState(0);
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setMade(null);
          setRound((n) => n + 1);
        }
      }}
      title={made ? copy.buat.siap : copy.buat.judul}
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
      {made ? (
        <Made link={made} onDone={() => onOpenChange(false)} />
      ) : (
        <MakeForm
          key={round}
          onCancel={() => onOpenChange(false)}
          onMade={(l) => {
            setMade(l);
            onMade(l.id);
          }}
        />
      )}
    </Modal>
  );
}

function Made({ link, onDone }: { link: Link; onDone: () => void }) {
  const desk = useMediaQuery(DESKTOP_QUERY);
  return (
    <>
      <div className="sl-made">
        <AddressBox name={link.name} />
      </div>
      <div className="g-ov-foot sl-made-foot">
        <Button variant="paper" onClick={onDone}>
          {copy.buat.selesai}
        </Button>
        {desk ? null : <ShareSheetButton name={link.name} />}
        <CopyButton name={link.name} variant="gold" size="md" autoFocus />
      </div>
    </>
  );
}

function MakeForm({
  onCancel,
  onMade,
}: {
  onCancel: () => void;
  onMade: (l: Link) => void;
}) {
  const client = useQueryClient();
  const id = useId();
  const [dest, setDest] = useState('');
  const [destErr, setDestErr] = useState<DestinationProblem | null>(null);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const destRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useNameStatus(name, { optional: true });

  const submit = async () => {
    if (saving) return;
    const dp = destinationProblem(dest);
    setDestErr(dp);
    setTried(true);
    if (dp) return destRef.current?.focus();
    if (status.refusal) return nameRef.current?.focus();
    setSaving(true);
    try {
      const link = await createLink(dest.trim(), name);
      void refreshAll(client);
      onMade(link);
    } catch (e) {
      const body =
        e instanceof ApiError ? (e.body as ShortLinkProblem | undefined) : null;
      if (body?.destination) {
        setDestErr(body.destination);
        destRef.current?.focus();
      } else if (body?.problem) {
        setStatus({
          refusal: {
            problem: body.problem,
            heldAs: body.heldAs,
            heldBy: body.heldBy,
          },
          checking: false,
          free: false,
        });
        nameRef.current?.focus();
      } else toast.error(copy.buat.gagal);
    } finally {
      setSaving(false);
    }
  };

  const nameBad = tried && !!status.refusal;
  return (
    <form
      className="sl-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="sl-fld">
        <label className="t-label strong" htmlFor={`${id}-dest`}>
          {copy.buat.tujuan}
        </label>
        <input
          ref={destRef}
          className="g-field"
          data-autofocus=""
          id={`${id}-dest`}
          type="url"
          inputMode="url"
          placeholder="https://"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={dest}
          aria-invalid={destErr ? true : undefined}
          aria-describedby={destErr ? `${id}-dest-e` : undefined}
          onChange={(e) => setDest(e.target.value)}
        />
        {destErr ? (
          <FieldError id={`${id}-dest-e`}>
            {copy.tujuanMasalah[destErr]}
          </FieldError>
        ) : null}
      </div>
      <div className={cn('sl-fld sl-edit', nameBad && 'is-bad')}>
        <span className="t-label strong" id={`${id}-name-t`}>
          {copy.buat.namaPendek}
        </span>
        <NameInput
          inputRef={nameRef}
          value={name}
          onChange={(v) => {
            setName(v);
            setTried(false);
          }}
          labelledBy={`${id}-name-t`}
          describedBy={`${id}-name-st ${id}-name-h`}
          invalid={nameBad}
        />
        <NameStatusLine id={`${id}-name-st`} status={status} name={name} />
        <p className="t-cap text-fg-3" id={`${id}-name-h`}>
          {copy.buat.kosongkan}
        </p>
      </div>
      <div className="g-ov-foot">
        <Button variant="paper" onClick={onCancel}>
          {copy.buat.batal}
        </Button>
        <Button
          variant="gold"
          type="submit"
          aria-disabled={saving || undefined}
        >
          {saving ? copy.buat.membuat : copy.buat.buat}
        </Button>
      </div>
    </form>
  );
}
