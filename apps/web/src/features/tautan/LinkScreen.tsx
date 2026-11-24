import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ApiError, type ShortLinkProblem } from '~/api/generated';
import {
  Button,
  ConfirmDialog,
  DESKTOP_QUERY,
  EmptyState,
  ErrorState,
  LinkButton,
  Skeleton,
  SkeletonRow,
  toast,
  useMediaQuery,
} from '~/components/garis';
import { IconAmbil } from '~/components/icons/ambil';
import { IconForm } from '~/components/icons/form';
import { IconHapus } from '~/components/icons/hapus';
import { IconLonceng } from '~/components/icons/lonceng';
import { DeskHead, PageBody, usePageTitle } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { tautan as copy } from '~/copy/tautan';
import useSession from '~/hooks/auth/useSession';
import { SHORT_HOST } from '~/lib/short-name';
import { cn } from '~/lib/utils';
import { GiveDialog } from './GiveDialog';
import {
  AddressBox,
  CopyButton,
  FieldError,
  NameInput,
  NameStatusLine,
  ShareSheetButton,
  SlState,
  UnclaimedTag,
  useNameStatus,
} from './parts';
import {
  changeDestination,
  deleteLink,
  keepLink,
  linkQuery,
  refreshAll,
  renameLink,
  type Link,
} from './queries';
import { bareUrl, destinationProblem, linkDates } from './rules';
import './tautan.css';

/**
 * A link's page: its address (Ubah renames it; the old name keeps working), Salin tautan, where it goes (Ubah changes
 * it in place), its clicks and dates, its older names, and Hapus tautan. A form's link only says which form it opens.
 * After an admin moved or deleted it, its last holder lands here from the push and reads what happened, once.
 * `admin`: opened from Kelola, where "Pemilik" always shows.
 */
export function LinkScreen({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const link = useQuery(linkQuery(id));
  if (link.data) return <Loaded link={link.data} admin={admin} />;
  if (link.error instanceof ApiError && link.error.status === 404)
    return <Gone kind="missing" />;
  return (
    <>
      <DeskHead title={copy.judul} />
      <PageBody>
        {link.isError ? (
          <ErrorState
            title={copy.tautan.gagal}
            onRetry={() => void link.refetch()}
            retrying={link.isFetching}
          />
        ) : (
          <Skeleton label={copy.tautan.memuat}>
            <SkeletonRow lines={['70%']} />
            {[0, 1, 2].map((i) => (
              <SkeletonRow key={i} lines={['30%', '60%']} />
            ))}
          </Skeleton>
        )}
      </PageBody>
    </>
  );
}

/** What the last holder reads after an admin's change, or anyone reads for a link that isn't theirs. */
function Gone({
  kind,
  name,
  to,
}: {
  kind: 'moved' | 'deleted' | 'missing';
  name?: string;
  to?: string | null;
}) {
  usePageTitle(name ?? copy.tautan.tidakAda);
  const mine = (
    <Button variant="gold" asChild>
      <RouterLink to="/layanan/tautan">{copy.tautan.lihatTautanku}</RouterLink>
    </Button>
  );
  return (
    <>
      <DeskHead title={name ?? copy.tautan.tidakAda} />
      <PageBody>
        {kind === 'missing' ? (
          <EmptyState title={copy.tautan.tidakAda} action={mine} />
        ) : kind === 'moved' ? (
          <SlState
            icon={<IconAmbil size={24} />}
            title={copy.tautan.dipindahkan}
            text={fill(copy.tautan.dipindahkanIsi, {
              nama: name ?? '',
              pemilik: to ?? '',
            })}
          >
            {mine}
          </SlState>
        ) : (
          <SlState
            icon={<IconHapus size={24} />}
            title={copy.tautan.sudahDihapus}
            text={fill(copy.tautan.sudahDihapusIsi, { nama: name ?? '' })}
          >
            {mine}
          </SlState>
        )}
      </PageBody>
    </>
  );
}

function Loaded({ link, admin }: { link: Link; admin: boolean }) {
  const me = useSession();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const [editing, setEditing] = useState<'dest' | 'name' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [giving, setGiving] = useState(false);
  const nameBtn = useRef<HTMLButtonElement>(null);
  const destBtn = useRef<HTMLButtonElement>(null);
  usePageTitle(link.state === 'own' ? link.name : link.name);

  if (link.state === 'moved')
    return <Gone kind="moved" name={link.name} to={link.movedTo} />;
  if (link.state === 'deleted') return <Gone kind="deleted" name={link.name} />;

  const someoneElse = !!link.owner && link.owner.id !== me?.id;
  const showOwner = admin || someoneElse || (!link.owner && !link.form);
  const close = (which: 'dest' | 'name') => {
    setEditing(null);
    requestAnimationFrame(() =>
      (which === 'dest' ? destBtn : nameBtn).current?.focus(),
    );
  };
  const { made, changed } = linkDates(link);

  const facts: [string, ReactNode][] = [];
  if (link.form)
    facts.push([
      copy.tautan.fakta.membuka,
      <span key="f">
        {fill(copy.tautan.membukaForm, { judul: link.form.title })}
      </span>,
    ]);
  else if (editing === 'dest')
    facts.push([
      copy.tautan.fakta.tujuan,
      <DestEditor key="d" link={link} onDone={() => close('dest')} />,
    ]);
  else
    facts.push([
      copy.tautan.fakta.tujuan,
      <span className="sl-fact" key="d">
        <a
          className="sl-dest"
          href={link.destination ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          {bareUrl(link.destination ?? '')}
          <span className="sr-only"> {common.shell.situsLuar}</span>
        </a>
        {link.canEdit ? (
          <LinkButton
            ref={destBtn}
            onClick={() => setEditing('dest')}
            aria-label={copy.tautan.ubahTujuan}
          >
            {copy.tautan.ubah}
          </LinkButton>
        ) : null}
      </span>,
    ]);
  facts.push([
    copy.tautan.fakta.dibuka,
    <span className="num" key="n">
      {fill(copy.tautan.kali, { jumlah: link.clicks.toLocaleString('id-ID') })}
    </span>,
  ]);
  facts.push([
    copy.tautan.fakta.dibuat,
    <span className="num" key="m">
      {made}
    </span>,
  ]);
  if (changed)
    facts.push([
      copy.tautan.fakta.diubah,
      <span className="num" key="c">
        {changed}
      </span>,
    ]);
  if (link.olderNames.length)
    facts.push([
      copy.tautan.fakta.namaLama,
      <span className="sl-prev" key="o">
        {link.olderNames.map((n) => (
          <span className="block" key={n}>
            {SHORT_HOST}
            {n}
          </span>
        ))}
      </span>,
    ]);
  if (showOwner)
    facts.push([
      copy.tautan.fakta.pemilik,
      link.owner ? (
        <span className="sl-fact" key="p">
          <span>
            {link.owner.fullName}
            <span className="block t-cap text-fg-2 num">{link.owner.nim}</span>
          </span>
          {link.form ? null : (
            <LinkButton onClick={() => setGiving(true)}>
              {copy.kelola.pindahkan}
            </LinkButton>
          )}
        </span>
      ) : (
        <span className="sl-fact" key="p">
          <span>
            <UnclaimedTag />
            {link.oldAccount ? (
              <span className="block t-cap text-fg-2">
                {fill(copy.kelola.akunLama, {
                  akun: link.oldAccount.username,
                })}
              </span>
            ) : null}
          </span>
          <LinkButton onClick={() => setGiving(true)}>
            {copy.kelola.berikan}
          </LinkButton>
        </span>
      ),
    ]);

  return (
    <>
      <DeskHead title={link.name} />
      <PageBody className="gap-[18px]">
        <div className="sl-head">
          {editing === 'name' ? (
            <NameEditor link={link} onDone={() => close('name')} />
          ) : (
            <>
              <AddressBox
                name={link.name}
                editRef={nameBtn}
                onEdit={link.canEdit ? () => setEditing('name') : undefined}
              />
              <div className="sl-acts">
                <CopyButton name={link.name} />
                {desk ? null : <ShareSheetButton name={link.name} />}
              </div>
            </>
          )}
        </div>
        <ul className="g-ruled-list g-facts-list sl-facts">
          {facts.map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              {v}
            </li>
          ))}
        </ul>
        {link.form ? (
          <Button variant="paper" asChild className="sl-foot">
            <RouterLink
              to="/kelola/form/$formId"
              params={{ formId: link.form.id }}
            >
              <IconForm size={16} />
              {copy.tautan.bukaForm}
            </RouterLink>
          </Button>
        ) : (
          <Button
            variant="danger-ghost"
            className="sl-foot"
            onClick={() => setDeleting(true)}
          >
            <IconHapus size={20} />
            {copy.tautan.hapus}
          </Button>
        )}
      </PageBody>
      <DeleteDialog
        link={link}
        open={deleting}
        onOpenChange={setDeleting}
        admin={admin}
        ownerTold={someoneElse ? link.owner!.fullName : null}
      />
      {giving ? (
        <GiveDialog
          link={link}
          open={giving}
          onOpenChange={setGiving}
          ownerTold={someoneElse ? link.owner!.fullName : null}
        />
      ) : null}
    </>
  );
}

function DestEditor({ link, onDone }: { link: Link; onDone: () => void }) {
  const client = useQueryClient();
  const id = useId();
  const [value, setValue] = useState(link.destination ?? '');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverBad, setServerBad] = useState<'invalid' | 'self' | null>(null);
  const local = destinationProblem(value);
  const problem = tried ? (serverBad ?? local) : null;
  const input = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (saving) return;
    setTried(true);
    if (local) return input.current?.focus();
    if (value.trim() === link.destination) return onDone();
    setSaving(true);
    try {
      keepLink(client, await changeDestination(link.id, value.trim()));
      toast.success(copy.tautan.tujuanDiubah);
      onDone();
    } catch (e) {
      const body =
        e instanceof ApiError ? (e.body as ShortLinkProblem | undefined) : null;
      if (body?.destination) {
        setServerBad(body.destination);
        input.current?.focus();
      } else toast.error(copy.tautan.gagalUbah);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="sl-inline" data-own-escape="">
      <label className="sr-only" htmlFor={`${id}-d`}>
        {copy.tautan.tujuanBaru}
      </label>
      <input
        ref={input}
        autoFocus
        className="g-field"
        id={`${id}-d`}
        type="url"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-e` : undefined}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setValue(e.target.value);
          setServerBad(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void save();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onDone();
          }
        }}
      />
      {problem ? (
        <FieldError id={`${id}-e`}>{copy.tujuanMasalah[problem]}</FieldError>
      ) : null}
      <div className="sl-ed-acts">
        <Button
          variant="gold"
          size="sm"
          aria-disabled={saving || undefined}
          onClick={() => void save()}
        >
          {saving ? copy.tautan.menyimpan : copy.tautan.simpan}
        </Button>
        <Button variant="paper" size="sm" onClick={onDone}>
          {copy.tautan.batal}
        </Button>
      </div>
    </div>
  );
}

function NameEditor({ link, onDone }: { link: Link; onDone: () => void }) {
  const client = useQueryClient();
  const id = useId();
  const [name, setName] = useState(link.name);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useNameStatus(name, {
    current: link.name,
    linkId: link.id,
  });
  const empty = tried && !name;
  // Once, when the editor opens: the name selected, ready to be typed over or moved through.
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const save = async () => {
    if (saving) return;
    if (name === link.name) return onDone();
    if (!name || status.refusal) {
      setTried(true);
      return input.current?.focus();
    }
    setSaving(true);
    try {
      keepLink(client, await renameLink(link.id, name));
      toast.success(copy.tautan.namaDiubah);
      onDone();
    } catch (e) {
      const body =
        e instanceof ApiError ? (e.body as ShortLinkProblem | undefined) : null;
      if (body?.problem) {
        setStatus({
          refusal: {
            problem: body.problem,
            heldAs: body.heldAs,
            heldBy: body.heldBy,
          },
          checking: false,
          free: false,
        });
        setTried(true);
        input.current?.focus();
      } else toast.error(copy.tautan.gagalUbah);
    } finally {
      setSaving(false);
    }
  };
  const bad = tried && (!!status.refusal || empty);
  return (
    <section className="sl-lk" aria-labelledby={`${id}-t`}>
      <div className={cn('sl-edit', bad && 'is-bad')} data-own-escape="">
        <span className="t-label strong" id={`${id}-t`}>
          {copy.buat.namaPendek}
        </span>
        <NameInput
          inputRef={input}
          value={name}
          onChange={(v) => {
            setName(v);
            setTried(false);
          }}
          labelledBy={`${id}-t`}
          describedBy={`${id}-st ${id}-h`}
          invalid={bad}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onDone();
            }
          }}
        />
        <NameStatusLine
          id={`${id}-st`}
          status={status}
          name={name}
          empty={empty}
        />
        <p className="t-cap text-fg-3" id={`${id}-h`}>
          {fill(copy.tautan.tetapBisa, { nama: link.name })}
        </p>
        <div className="sl-ed-acts">
          <Button
            variant="gold"
            size="sm"
            aria-disabled={saving || undefined}
            onClick={() => void save()}
          >
            {saving ? copy.tautan.menyimpan : copy.tautan.simpan}
          </Button>
          <Button variant="paper" size="sm" onClick={onDone}>
            {copy.tautan.batal}
          </Button>
        </div>
      </div>
    </section>
  );
}

function DeleteDialog({
  link,
  open,
  onOpenChange,
  admin,
  ownerTold,
}: {
  link: Link;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  admin: boolean;
  ownerTold: string | null;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={fill(copy.tautan.hapusJudul, { nama: link.name })}
      cancelLabel={copy.tautan.batal}
      confirmLabel={copy.tautan.hapus}
      danger
      busy={busy}
      onConfirm={async () => {
        setBusy(true);
        try {
          await deleteLink(link.id);
          client.removeQueries({ queryKey: ['short-links', 'link', link.id] });
          void refreshAll(client);
          onOpenChange(false);
          toast.success(copy.tautan.dihapus);
          void navigate({
            to: admin ? '/kelola/tautan' : '/layanan/tautan',
            replace: true,
          });
        } catch {
          toast.error(copy.tautan.gagalHapus);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        <b className="strong text-fg">{copy.tautan.hapusBerhenti}</b>{' '}
        {copy.tautan.hapusTermasuk}
        {link.clicks
          ? ` ${fill(copy.tautan.hapusDibuka, { jumlah: link.clicks.toLocaleString('id-ID') })}`
          : ''}{' '}
        {copy.tautan.hapusAkhir}
      </p>
      {ownerTold ? (
        <p className="sl-note mt-3 t-cap text-fg-3">
          <IconLonceng size={16} />
          <span>{fill(copy.tautan.hapusDiberiTahu, { nama: ownerTold })}</span>
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
