import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ApiError,
  type FormAccessList,
  type FormPerson,
  type ManageForm,
} from '~/api/generated';
import {
  Avatar,
  Button,
  ErrorState,
  Menu,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  Modal,
  RowButton,
  RuledList,
  Searchbox,
  Skeleton,
  SkeletonRow,
  Tag,
  toast,
} from '~/components/garis';
import { IconBagikan } from '~/components/icons/bagikan';
import { IconBawah } from '~/components/icons/bawah';
import { IconCentang } from '~/components/icons/centang';
import { IconKunci } from '~/components/icons/kunci';
import { IconMata } from '~/components/icons/mata';
import { IconPensil } from '~/components/icons/pensil';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTambah } from '~/components/icons/tambah';
import { IconTutup } from '~/components/icons/tutup';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import useSession from '~/hooks/auth/useSession';
import { initialsOf } from '~/lib/shell/names';
import { CopyButton, LinkBox } from './parts';
import {
  checkSlug,
  formAccessQuery,
  keepForm,
  manageKeys,
  removeAccess,
  renameSlug,
  searchPeople,
  setAccess,
} from './queries';
import {
  audienceLabel,
  LINK_HOST,
  linkOf,
  slugProblem,
  tidySlug,
  whenShort,
  type SlugProblem,
} from './rules';

/**
 * Bagikan, in two parts named for who each is for: "Tautan untuk anggota" (the form's address, Ubah, Salin tautan,
 * and the device's share sheet where there is one) and "Akses pengurus" (find a pengurus by name or NIM, give
 * "Lihat jawaban" or "Edit", change or remove it; the owner's row is never touched).
 */
export function ShareDialog({
  form,
  open,
  onOpenChange,
  startEditing = false,
}: {
  form: ManageForm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startEditing?: boolean;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={fill(copy.akses.judulDialog, {
        judul: form.title.trim() || copy.daftar.tanpaJudul,
      })}
      footer={
        <Button variant="gold" onClick={() => onOpenChange(false)}>
          {copy.akses.selesai}
        </Button>
      }
    >
      <LinkPart form={form} startEditing={startEditing} />
      <AccessPart form={form} />
    </Modal>
  );
}

/** The form's link: its address, renamed in place by those who may edit it. */
export function LinkPart({
  form,
  startEditing,
}: {
  form: ManageForm;
  startEditing: boolean;
}) {
  const [editing, setEditing] = useState(startEditing && form.access.canEdit);
  const editBtn = useRef<HTMLButtonElement>(null);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const notes = [
    !form.publishedAt
      ? copy.tautan.setelahTerbit
      : form.eligibleAngkatan.length
        ? fill(copy.tautan.hanya, {
            angkatan: audienceLabel(form.eligibleAngkatan, undefined, true),
          })
        : '',
  ].filter(Boolean);
  return (
    <section className="fb-lk" aria-labelledby="fb-lk-t">
      <h3 className="t-label text-fg-2" id="fb-lk-t">
        {copy.tautan.judul}
      </h3>
      {editing ? (
        <SlugEditor
          form={form}
          onDone={() => {
            setEditing(false);
            requestAnimationFrame(() => editBtn.current?.focus());
          }}
        />
      ) : (
        <>
          <LinkBox
            slug={form.slug}
            editRef={editBtn}
            onEdit={form.access.canEdit ? () => setEditing(true) : undefined}
          />
          {form.publishedAt ? (
            <div className="fb-lk-acts">
              <CopyButton slug={form.slug} />
              {canShare ? <ShareSheetButton form={form} /> : null}
            </div>
          ) : null}
          {notes.length ? (
            <p className="t-cap text-fg-3 num">{notes.join(' ')}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** "Bagikan lewat…": the device's own share sheet, with the form's title, when it closes, and its address. */
export function ShareSheetButton({
  form,
  variant = 'paper',
}: {
  form: ManageForm;
  variant?: 'paper';
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => {
        const text = form.closesAt
          ? fill(copy.tautan.tutupPada, {
              judul: form.title,
              waktu: whenShort(form.closesAt),
            })
          : form.title;
        navigator
          .share?.({ title: form.title, text, url: linkOf(form.slug) })
          .catch(() => {});
      }}
    >
      <IconBagikan size={16} />
      {copy.tautan.bagikanLewat}
    </Button>
  );
}

type Status = { ok: boolean; problem: SlugProblem | null; checking: boolean };

function SlugEditor({
  form,
  onDone,
}: {
  form: ManageForm;
  onDone: () => void;
}) {
  const client = useQueryClient();
  const { register, watch, setValue, setFocus, handleSubmit, formState } =
    useForm<{ slug: string }>({
      defaultValues: { slug: form.slug },
    });
  const slug = watch('slug');
  const [status, setStatus] = useState<Status>({
    ok: true,
    problem: null,
    checking: false,
  });
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setFocus('slug', { shouldSelect: true }), [setFocus]);
  // Escape in the field leaves the editor and keeps the dialog: caught before the dialog's own listener on the
  // document sees it.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key !== 'Escape' ||
        !(e.target as Element | null)?.matches?.('[data-slug-field]')
      )
        return;
      e.stopPropagation();
      e.preventDefault();
      doneRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // The local rules at once; whether another form holds it about 300 ms after the last key.
  useEffect(() => {
    if (slug === form.slug)
      return setStatus({ ok: true, problem: null, checking: false });
    const local = slugProblem(slug);
    if (local) return setStatus({ ok: false, problem: local, checking: false });
    setStatus({ ok: false, problem: null, checking: true });
    const t = setTimeout(() => {
      checkSlug(form.id, slug)
        .then((r) => {
          if (r.slug === slug)
            setStatus({
              ok: r.available,
              problem: r.available ? null : (r.problem ?? 'taken'),
              checking: false,
            });
        })
        .catch(() => setStatus({ ok: true, problem: null, checking: false }));
    }, 300);
    return () => clearTimeout(t);
  }, [slug, form.id, form.slug]);

  const field = register('slug', {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const tidy = tidySlug(el.value);
      if (tidy !== el.value) {
        const pos = el.selectionStart;
        setValue('slug', tidy);
        el.value = tidy;
        el.setSelectionRange(pos, pos);
      }
      if (tried) setTried(false);
    },
  });
  const save = handleSubmit(async ({ slug: v }) => {
    if (v === form.slug) return onDone();
    const local = slugProblem(v);
    if (local || status.problem) {
      setTried(true);
      if (local) setStatus({ ok: false, problem: local, checking: false });
      setFocus('slug');
      return;
    }
    setSaving(true);
    try {
      const kept = await renameSlug(form.id, v);
      keepForm(client, kept);
      toast.success(
        form.publishedAt ? copy.tautan.diubahLama : copy.tautan.diubah,
      );
      onDone();
    } catch (e) {
      const problem =
        e instanceof ApiError
          ? (e.body?.problem as SlugProblem | undefined)
          : undefined;
      if (problem) {
        setStatus({ ok: false, problem, checking: false });
        setTried(true);
        setFocus('slug');
      } else toast.error(copy.tautan.gagal);
    } finally {
      setSaving(false);
    }
  });
  const bad = tried && !!status.problem;
  return (
    <div className="fb-lk-edit">
      <label className="fb-lk-field">
        <span className="fb-lk-pre" id="fb-lk-pre">
          {LINK_HOST}
        </span>
        <input
          className="fb-lf"
          type="text"
          maxLength={40}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-labelledby="fb-lk-t fb-lk-pre"
          aria-describedby="fb-lk-st fb-lk-h"
          aria-invalid={bad || undefined}
          data-slug-field=""
          {...field}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
          }}
        />
      </label>
      <p className="fb-lk-st" id="fb-lk-st" role="status">
        {status.checking ? (
          <span className="wait">{copy.tautan.memeriksa}</span>
        ) : status.problem ? (
          <span className="no">
            <IconPeringatan size={16} />
            {copy.tautan.masalah[status.problem]}
          </span>
        ) : slug !== form.slug && status.ok ? (
          <span className="ok">
            <IconCentang size={16} />
            {copy.tautan.tersedia}
          </span>
        ) : null}
      </p>
      <p className="t-cap text-fg-3" id="fb-lk-h">
        {copy.tautan.aturan}
        {form.publishedAt ? ` ${copy.tautan.lamaBerhenti}` : ''}
      </p>
      <div className="fb-acts">
        <Button
          variant="gold"
          size="sm"
          aria-disabled={saving || formState.isSubmitting || undefined}
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

const ROLE_ICON = {
  view: <IconMata size={20} />,
  edit: <IconPensil size={20} />,
};

function AccessPart({ form }: { form: ManageForm }) {
  const me = useSession();
  const client = useQueryClient();
  const access = useQuery(formAccessQuery(form.id));
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{
    q: string;
    people: { person: FormPerson; isPengurus: boolean; role: string | null }[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const term = q.trim();

  // One request per finished search: about 300 ms after the last key, from three characters.
  useEffect(() => {
    if (term.length < 3) {
      setFound(null);
      return;
    }
    setSearching(true);
    setFailed(false);
    const t = setTimeout(() => {
      searchPeople(form.id, term)
        .then((r) => setFound({ q: term, people: r.people }))
        .catch(() => setFailed(true))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [term, form.id]);

  const apply = (list: FormAccessList) =>
    client.setQueryData(manageKeys.access(form.id), list);
  const change = async (
    person: FormPerson,
    role: 'view' | 'edit' | null,
    after?: () => void,
  ) => {
    try {
      if (role) apply(await setAccess(form.id, person.id, role));
      else {
        const before = access.data?.people.find(
          (p) => p.person.id === person.id,
        )?.role;
        apply(await removeAccess(form.id, person.id));
        toast.success(fill(copy.akses.dihapus, { nama: person.fullName }), {
          action: before
            ? {
                label: common.komponen.urungkan,
                onClick: () =>
                  void setAccess(form.id, person.id, before).then(apply),
              }
            : undefined,
        });
      }
      after?.();
    } catch {
      toast.error(copy.akses.gagalUbah);
    }
  };

  const owner = access.data?.owner ?? form.owner;
  const results =
    found && found.q === term
      ? found.people.filter((p) => p.role !== 'owner')
      : null;

  return (
    <section className="fb-access" aria-labelledby="fb-acc-t">
      <h3 className="t-label text-fg-2" id="fb-acc-t">
        {copy.akses.judul}
      </h3>
      <Searchbox
        ref={searchRef}
        label={copy.akses.cari}
        placeholder={copy.akses.cariPlaceholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        data-share-q=""
      />
      {term.length > 0 && term.length < 3 ? (
        <p className="t-cap text-fg-3">{copy.akses.minimal}</p>
      ) : failed ? (
        <p className="g-err t-cap" role="status">
          {copy.akses.gagalCari}
        </p>
      ) : searching && !results ? (
        <p className="t-cap text-fg-3" role="status">
          {copy.akses.mencari}
        </p>
      ) : results ? (
        results.length ? (
          <RuledList className="fb-res" aria-label={copy.akses.cari}>
            {results.map((p) => {
              const pick = p.isPengurus && !p.role;
              return (
                <li key={p.person.id}>
                  <RowButton
                    aria-disabled={!pick || undefined}
                    onClick={() => {
                      if (!pick) return;
                      void change(p.person, 'view', () => {
                        setQ('');
                        toast.success(
                          fill(copy.akses.ditambahkan, {
                            nama: p.person.fullName,
                          }),
                        );
                        requestAnimationFrame(() =>
                          document
                            .querySelector<HTMLElement>(
                              `[data-role-of="${p.person.id}"]`,
                            )
                            ?.focus(),
                        );
                      });
                    }}
                  >
                    <span className="fb-person">
                      <Avatar
                        initials={initialsOf(p.person.fullName)}
                        picture={p.person.picture}
                      />
                      <span className="grow">
                        <span className="block t-sub">{p.person.fullName}</span>
                        <span className="block t-cap text-fg-2 num">
                          {p.person.nim}
                        </span>
                      </span>
                      {pick ? (
                        <Tag tone="accent" icon={<IconTambah size={16} />}>
                          {copy.akses.tambah}
                        </Tag>
                      ) : (
                        <span className="t-cap text-fg-3">
                          {p.role
                            ? copy.akses.sudahPunya
                            : copy.akses.bukanPengurus}
                        </span>
                      )}
                    </span>
                  </RowButton>
                </li>
              );
            })}
          </RuledList>
        ) : (
          <p className="t-cap text-fg-3" role="status">
            {fill(copy.akses.tidakAda, { q: term })}
          </p>
        )
      ) : null}
      {access.isPending ? (
        <Skeleton label={copy.akses.memuat}>
          <SkeletonRow lines={['50%', '30%']} />
        </Skeleton>
      ) : access.isError ? (
        <ErrorState
          title={copy.akses.gagal}
          onRetry={() => void access.refetch()}
          retrying={access.isFetching}
        />
      ) : (
        <RuledList>
          {owner ? (
            <PersonRow
              person={owner}
              you={owner.id === me?.id}
              right={
                <span className="t-sm text-fg-2">{copy.akses.pemilik}</span>
              }
            />
          ) : null}
          {access.data.people.map(({ person, role }) => (
            <PersonRow
              key={person.id}
              person={person}
              you={person.id === me?.id}
              right={
                person.id === me?.id ? (
                  <span className="t-sm text-fg-2">
                    {copy.akses.peran[role]}
                  </span>
                ) : (
                  <Menu
                    className="fb-menu"
                    trigger={
                      <button
                        type="button"
                        className="fb-type sm"
                        data-role-of={person.id}
                        aria-label={fill(copy.akses.aksesOrangPeran, {
                          nama: person.fullName,
                          peran: copy.akses.peran[role],
                        })}
                      >
                        {copy.akses.peran[role]}
                        <span className="c">
                          <IconBawah size={16} />
                        </span>
                      </button>
                    }
                  >
                    <MenuRadioGroup
                      value={role}
                      onValueChange={(v) =>
                        void change(person, v as 'view' | 'edit')
                      }
                      label={fill(copy.akses.aksesOrang, {
                        nama: person.fullName,
                      })}
                    >
                      {(['view', 'edit'] as const).map((r) => (
                        <MenuRadioItem
                          key={r}
                          value={r}
                          icon={ROLE_ICON[r]}
                          hint={copy.akses.peranIsi[r]}
                        >
                          {copy.akses.peran[r]}
                        </MenuRadioItem>
                      ))}
                    </MenuRadioGroup>
                    <MenuSeparator />
                    <MenuItem
                      danger
                      icon={<IconTutup size={20} />}
                      onSelect={() =>
                        void change(person, null, () =>
                          requestAnimationFrame(() =>
                            searchRef.current?.focus(),
                          ),
                        )
                      }
                    >
                      {copy.akses.hapusAkses}
                    </MenuItem>
                  </Menu>
                )
              }
            />
          ))}
        </RuledList>
      )}
      <p className="fb-note t-cap text-fg-3">
        <IconKunci size={16} />
        <span>
          {form.requestedFields.length
            ? copy.akses.catatanData
            : copy.akses.catatanSemua}
        </span>
      </p>
    </section>
  );
}

function PersonRow({
  person,
  you,
  right,
}: {
  person: FormPerson;
  you: boolean;
  right: React.ReactNode;
}) {
  return (
    <li className="fb-person">
      <Avatar initials={initialsOf(person.fullName)} picture={person.picture} />
      <span className="grow">
        <span className="block t-sub">
          {person.fullName}
          {you ? <span className="you"> {copy.akses.kamu}</span> : null}
        </span>
        <span className="block t-cap text-fg-2 num">{person.nim}</span>
      </span>
      {right}
    </li>
  );
}
