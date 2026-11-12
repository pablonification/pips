/**
 * Tambah lomba and Ubah lomba's poster: the composer's photo tiles at Info Lomba's 3:4: the poster with Hapus poster
 * at its corner, and beside it a tile to add one or pick another. An image uploads as soon as it's picked, with its
 * progress; a failed one says so on the poster (icon, word, colour) with Coba lagi, and the dialog won't save until
 * it's settled.
 */
import { useEffect, useRef, useState } from 'react';
import { IconButton, LinkButton, Media } from '~/components/garis';
import { IconFoto } from '~/components/icons/foto';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTutup } from '~/components/icons/tutup';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { kelolaLomba as t } from '~/copy/kelola-lomba';
import { uploadImage } from '~/lib/upload';
import {
  acceptList,
  uploadProblem,
  UploadRefused,
  type UploadProblem,
} from '~/lib/upload-policy';
import type { PosterUpload } from './rules';

interface PosterFieldProps {
  id: string;
  /** The stored or uploaded poster's address; null for none. */
  poster: string | null;
  onPoster: (url: string | null) => void;
  upload: PosterUpload | null;
  onUpload: (u: PosterUpload | null) => void;
  /** Why the dialog won't save yet (posterBlock), said under the poster. */
  blocked: string | null;
}

export function PosterField({
  id,
  poster,
  onPoster,
  upload,
  onUpload,
  blocked,
}: PosterFieldProps) {
  // The image picked last: shown from the device while it uploads and after, and sent again by Coba lagi.
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(
    null,
  );
  const [broken, setBroken] = useState<string | null>(null);
  // A picked file that can't be uploaded, and why: said under the poster until the next pick.
  const [refused, setRefused] = useState<{
    name: string;
    problem: UploadProblem;
  } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // The dialog closed: the upload stops, and nothing reports back.
  useEffect(
    () => () => {
      const going = abort.current;
      abort.current = null;
      going?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (picked) URL.revokeObjectURL(picked.preview);
    },
    [picked],
  );

  const send = (file: File) => {
    abort.current?.abort();
    const mine = new AbortController();
    abort.current = mine;
    onUpload({ status: 'uploading', progress: 0 });
    uploadImage(
      file,
      (progress) => {
        if (abort.current === mine) onUpload({ status: 'uploading', progress });
      },
      mine.signal,
    ).then(
      (url) => {
        if (abort.current !== mine) return;
        abort.current = null;
        onUpload(null);
        onPoster(url);
      },
      (err: unknown) => {
        if (abort.current !== mine) return;
        abort.current = null;
        if (err instanceof UploadRefused) {
          // Trying again won't help: the poster goes back to what it was, and the reason is said.
          setPicked(null);
          setRefused({ name: file.name, problem: err.problem });
          onUpload(null);
          return;
        }
        onUpload({ status: 'failed' });
      },
    );
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = uploadProblem(file, 'image');
    setRefused(problem ? { name: file.name, problem } : null);
    if (problem) return;
    setPicked({ file, preview: URL.createObjectURL(file) });
    send(file);
  };

  const remove = () => {
    abort.current?.abort();
    abort.current = null;
    setPicked(null);
    onUpload(null);
    onPoster(null);
    requestAnimationFrame(() => input.current?.focus());
  };

  const shown = picked?.preview ?? poster;
  return (
    <div className="g-fld" role="group" aria-labelledby={`${id}-l`}>
      <p className="t-label" id={`${id}-l`}>
        {t.poster} <span className="font-normal text-fg-3">{t.opsional}</span>
      </p>
      <div className="g-poster-field">
        {shown ? (
          <span
            className="g-poster-pick"
            data-poster={upload?.status ?? 'done'}
          >
            <Media
              src={broken === shown ? undefined : shown}
              alt={t.poster}
              ratio="3 / 4"
              onError={() => setBroken(shown)}
            />
            {upload?.status === 'uploading' ? (
              <span className="state" role="status">
                {fill(t.mengunggah, { persen: upload.progress })}
                <span className="bar">
                  <i style={{ width: `${upload.progress}%` }} />
                </span>
              </span>
            ) : upload?.status === 'failed' ? (
              <span className="state" role="alert">
                <span className="inline-flex items-center gap-1">
                  <IconPeringatan size={16} />
                  {t.gagalUnggah}
                </span>
                {picked ? (
                  <LinkButton inText onClick={() => send(picked.file)}>
                    {common.actions.cobaLagi}
                  </LinkButton>
                ) : null}
              </span>
            ) : null}
            <IconButton className="del" label={t.hapusPoster} onClick={remove}>
              <IconTutup size={16} />
            </IconButton>
          </span>
        ) : null}
        <label className="g-add-poster">
          <IconFoto size={24} />
          {shown ? t.gantiPoster : t.tambahPoster}
          <input
            ref={input}
            id={id}
            type="file"
            accept={acceptList('image')}
            className="sr-only"
            {...(blocked ? { 'aria-describedby': `${id}-block` } : {})}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {refused ? (
        <p className="g-err t-cap" role="alert">
          <IconPeringatan size={16} />
          {fill(
            refused.problem === 'jenis'
              ? common.unggah.jenisFile
              : common.unggah.ukuranFile,
            { nama: refused.name },
          )}
        </p>
      ) : null}
      {blocked ? (
        <p className="g-err t-cap" id={`${id}-block`} role="status">
          <IconPeringatan size={16} />
          {blocked}
        </p>
      ) : null}
    </div>
  );
}
