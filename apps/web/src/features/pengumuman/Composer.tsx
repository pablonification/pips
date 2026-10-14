/**
 * Buat pengumuman (`composeForm`, the `compose` submit handler): a focused page on phones and tablets, a dialog
 * over the split on desktop. The draft lives outside React, so rotating a tablet or resizing across 1024 px (page ↔
 * dialog) keeps what was typed; it starts fresh each time the composer opens, as the prototype does (open question
 * 4), except for what the share target hands over.
 */
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  Avatar,
  Button,
  Chip,
  Chips,
  Dialog,
  ErrorState,
  IconButton,
  Input,
  LinkButton,
  Media,
  Seg,
  Textarea,
  toast,
} from '~/components/garis';
import { IconFoto } from '~/components/icons/foto';
import { IconPengumuman } from '~/components/icons/pengumuman';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTutup } from '~/components/icons/tutup';
import { keepFocusOnNavigationTo } from '~/components/shell/focus';
import { entryAt } from '~/components/shell/shell-state';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { pengumuman as t } from '~/copy/pengumuman';
import useSession from '~/hooks/auth/useSession';
import { deleteSharedData } from '~/lib/share-db';
import { initialsOf } from '~/lib/shell/names';
import {
  addPhotos,
  patchDraft,
  removePhoto,
  resetComposer,
  setCompose,
  startUpload,
  takeShared,
  useCompose,
} from './compose-store';
import {
  useAngkatan,
  useCreateInfo,
  useGroups,
  usePostableCategories,
} from './data';
import {
  angLabel,
  audienceKinds,
  composeBody,
  firstError,
  MAX_BODY,
  MAX_TITLE,
  notifyLine,
  uploadedUrls,
  uploadsBlock,
  validateDraft,
  type AudienceKind,
  type Draft,
  type DraftErrors,
} from './rules';
import { focusSoon, useFeedView } from './view';

/* ================= The form ================= */

function useLeave() {
  const router = useRouter();
  const navigate = useNavigate();
  const view = useFeedView();
  return () => {
    const index =
      (router.state.location.state as { __TSR_index?: number }).__TSR_index ??
      0;
    const prev = index > 0 ? entryAt(index - 1) : undefined;
    if (
      prev?.pathname.startsWith('/pengumuman') &&
      prev.pathname !== '/pengumuman/tulis'
    )
      router.history.back();
    else void navigate({ to: '/pengumuman', search: view, replace: true });
  };
}

export function ComposeForm({
  desk,
  onCancel,
  onSent,
}: {
  desk: boolean;
  onCancel: () => void;
  /** Sent: the dialog closes onto the new post, which takes focus (not the Buat link that opened it). */
  onSent?: () => void;
}) {
  const me = useSession();
  const { draft, photos, errors } = useCompose();
  const ids = useId();
  const id = (k: string) => `${ids}-${k}`;
  const categories = usePostableCategories();
  const cats = categories.data;
  const { data: angkatan } = useAngkatan();
  const { data: groups } = useGroups();
  const create = useCreateInfo();
  const navigate = useNavigate();
  // Sending failed: said inside the form, with Coba lagi beside it (a toast sits outside the desktop dialog, where
  // the keyboard can't reach it and pressing it would close the dialog).
  const [sendFailed, setSendFailed] = useState(false);
  const body = useRef<HTMLTextAreaElement>(null);
  const catGroup = useRef<HTMLDivElement>(null);
  const audGroup = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    takeShared();
  }, []);

  const kinds = audienceKinds(groups ?? []);
  const labelOf: Record<AudienceKind, string> = {
    all: t.tulis.semua,
    angkatan: t.tulis.angkatan,
    group: t.tulis.grupku,
  };
  const values =
    draft.audType === 'angkatan'
      ? (angkatan ?? []).map((a) => ({ value: a.id, label: angLabel(a) }))
      : draft.audType === 'group'
        ? (groups ?? []).map((g) => ({ value: g.role, label: g.group }))
        : [];
  const blocked = uploadsBlock(photos.map((p) => p.state));
  const err = (k: keyof DraftErrors) =>
    errors[k] ? (
      <p className="g-err t-cap" id={id(`${k}-err`)}>
        <IconPeringatan size={16} />
        {errors[k]}
      </p>
    ) : null;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (create.isPending || blocked) return;
    const full: Draft = {
      ...draft,
      mediaUrls: uploadedUrls(photos.map((p) => p.state)),
    };
    const found = validateDraft(full);
    if (firstError(found)) {
      setCompose((s) => ({ ...s, errors: found }));
      const first = firstError(found);
      requestAnimationFrame(() => {
        if (first === 'body') body.current?.focus();
        else if (first === 'cats')
          catGroup.current?.querySelector<HTMLElement>('button')?.focus();
        else
          audGroup.current
            ?.querySelector<HTMLElement>('input:checked')
            ?.focus();
      });
      return;
    }
    setSendFailed(false);
    create.mutate(composeBody(full), {
      onSuccess: (created) => {
        toast.success(t.tulis.diumumkan);
        resetComposer();
        void deleteSharedData().catch(() => undefined);
        if (desk) {
          // The dialog closes onto the new post, selected in the list; its row takes focus, not the page's title.
          onSent?.();
          keepFocusOnNavigationTo(
            `/pengumuman/${encodeURIComponent(created.id)}`,
          );
          void navigate({
            to: '/pengumuman/$id',
            params: { id: created.id },
            search: {},
          });
          focusSoon(() =>
            document.querySelector<HTMLElement>(
              `[data-post-row="${CSS.escape(created.id)}"]`,
            ),
          );
        } else {
          void navigate({ to: '/pengumuman', search: {} });
          focusSoon(
            () =>
              document.querySelector<HTMLElement>(
                `[data-post-link="${CSS.escape(created.id)}"]`,
              ) ?? document.querySelector<HTMLElement>('[data-page-title]'),
          );
        }
      },
      onError: () => setSendFailed(true),
    });
  };

  return (
    <form
      className="g-compose"
      noValidate
      onSubmit={submit}
      aria-label={desk ? undefined : t.tulis.judul}
    >
      <div className="g-byline">
        <Avatar initials={initialsOf(me.fullName)} />
        <p className="t-label">
          <b>{me.fullName}</b>
        </p>
      </div>

      <div className="g-fld">
        <div className="g-fld-head">
          <label className="t-label" htmlFor={id('title')}>
            {t.tulis.judulField} <span className="opt">{t.tulis.opsional}</span>
          </label>
          <span className="g-counter" aria-hidden="true">
            {draft.title.length}/{MAX_TITLE}
          </span>
        </div>
        <Input
          id={id('title')}
          name="title"
          maxLength={MAX_TITLE}
          value={draft.title}
          autoComplete="off"
          data-compose-title=""
          onChange={(e) => patchDraft({ title: e.target.value })}
        />
      </div>

      <div className="g-fld">
        <div className="g-fld-head">
          <label className="t-label" htmlFor={id('body')}>
            {t.tulis.isi}
          </label>
          <span className="g-counter" aria-hidden="true">
            {draft.body.length}/{MAX_BODY}
          </span>
        </div>
        <Textarea
          ref={body}
          id={id('body')}
          name="body"
          rows={5}
          maxLength={MAX_BODY}
          value={draft.body}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? id('body-err') : undefined}
          onChange={(e) =>
            patchDraft(
              { body: e.target.value },
              e.target.value.trim() ? 'body' : undefined,
            )
          }
        />
        {err('body')}
      </div>

      <div
        className="g-fld"
        role="group"
        aria-labelledby={id('cat-l')}
        aria-describedby={errors.cats ? id('cats-err') : undefined}
        ref={catGroup}
      >
        <p className="t-label" id={id('cat-l')}>
          {t.tulis.kategori}
        </p>
        <Chips wrap>
          {(cats ?? []).map((c) => (
            <Chip
              key={c.id}
              kind="checkbox"
              selected={draft.cats.includes(c.id)}
              aria-invalid={errors.cats ? true : undefined}
              onSelectedChange={(on) =>
                patchDraft(
                  {
                    cats: on
                      ? [...draft.cats, c.id]
                      : draft.cats.filter((x) => x !== c.id),
                  },
                  'cats',
                )
              }
            >
              {c.name}
            </Chip>
          ))}
        </Chips>
        {/* F2-010: the categories didn't load, so nothing could be chosen and nothing said why. */}
        {categories.isError && !cats ? (
          <ErrorState
            onRetry={() => void categories.refetch()}
            retrying={categories.isFetching}
          />
        ) : null}
        {err('cats')}
      </div>

      <div className="g-fld" ref={audGroup}>
        <p className="t-label" id={id('aud-l')}>
          {t.tulis.untukSiapa}
        </p>
        <Seg
          label={t.tulis.untukSiapa}
          full
          value={draft.audType}
          options={kinds.map((k) => ({ value: k, label: labelOf[k] }))}
          onChange={(k) => patchDraft({ audType: k, aud: [] }, 'aud')}
        />
        {values.length ? (
          <Chips
            wrap
            label={
              draft.audType === 'angkatan'
                ? t.tulis.pilihAngkatan
                : t.tulis.pilihGrup
            }
            aria-describedby={errors.aud ? id('aud-err') : undefined}
          >
            {values.map((v) => (
              <Chip
                key={v.value}
                kind="checkbox"
                selected={draft.aud.includes(v.value)}
                onSelectedChange={(on) =>
                  patchDraft(
                    {
                      aud: on
                        ? [...draft.aud, v.value]
                        : draft.aud.filter((x) => x !== v.value),
                    },
                    'aud',
                  )
                }
              >
                {v.label}
              </Chip>
            ))}
          </Chips>
        ) : null}
        {err('aud') ?? (
          <p className="t-cap text-fg-3">
            {notifyLine(draft, {
              categories: cats ?? [],
              angkatan: angkatan ?? [],
              groups: groups ?? [],
            })}
          </p>
        )}
      </div>

      <div className="g-fld">
        <p className="t-label">{t.tulis.foto}</p>
        <div className="g-thumbs">
          {photos.map((p, i) => (
            <span key={p.key} className="g-thumb" data-photo={p.state.status}>
              <Media src={p.preview} alt="" ratio="1" />
              {p.state.status === 'uploading' ? (
                <span className="state" role="status">
                  {fill(t.tulis.mengunggah, { persen: p.state.progress })}
                  <span className="bar">
                    <i style={{ width: `${p.state.progress}%` }} />
                  </span>
                </span>
              ) : p.state.status === 'failed' ? (
                <span className="state failed" role="alert">
                  <span className="inline-flex items-center gap-1">
                    <IconPeringatan size={16} />
                    {t.tulis.gagalUnggah}
                  </span>
                  <LinkButton inText onClick={() => startUpload(p)}>
                    {common.actions.cobaLagi}
                  </LinkButton>
                </span>
              ) : null}
              <IconButton
                className="del"
                label={fill(t.tulis.hapusFoto, { nomor: i + 1 })}
                onClick={() => {
                  removePhoto(p.key);
                  requestAnimationFrame(() => fileInput.current?.focus());
                }}
              >
                <IconTutup size={16} />
              </IconButton>
            </span>
          ))}
          <label className="g-add-photo">
            <IconFoto size={24} />
            {t.tulis.tambahFoto}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                addPhotos([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {blocked ? (
        <p className="g-err t-cap" id={id('blocked')} role="status">
          <IconPeringatan size={16} />
          {blocked}
        </p>
      ) : null}
      {sendFailed && !create.isPending ? (
        <div className="g-send-err" role="alert">
          <p className="g-err t-cap">
            <IconPeringatan size={16} />
            {t.tulis.gagal}
          </p>
          <Button variant="paper" size="sm" onClick={() => submit()}>
            {common.actions.cobaLagi}
          </Button>
        </div>
      ) : null}
      <div className="g-ov-foot">
        <Button variant="paper" onClick={onCancel}>
          {t.tulis.batal}
        </Button>
        <Button
          variant="gold"
          type="submit"
          aria-disabled={blocked || create.isPending ? true : undefined}
          aria-describedby={blocked ? id('blocked') : undefined}
        >
          <IconPengumuman size={16} />
          {t.tulis.umumkan}
        </Button>
      </div>
    </form>
  );
}

/** The phone and tablet page. */
export function ComposePage() {
  const leave = useLeave();
  return <ComposeForm desk={false} onCancel={leave} />;
}

/** The desktop dialog over the split: Tutup, Batal, Escape and the backdrop return to the feed. */
export function ComposeDialog() {
  const leave = useLeave();
  // After a post the new row has focus; the dialog's own return to Buat would take it back as the dialog unmounts,
  // which on a slow device comes after the row was focused (CI on #9).
  const sent = useRef(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && leave()}
      onCloseAutoFocus={(e) => {
        if (sent.current) e.preventDefault();
      }}
      title={t.tulis.judul}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement | null)
          ?.querySelector<HTMLElement>('[data-compose-title]')
          ?.focus();
      }}
    >
      <ComposeForm
        desk
        onCancel={leave}
        onSent={() => {
          sent.current = true;
        }}
      />
    </Dialog>
  );
}
