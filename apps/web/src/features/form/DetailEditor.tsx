import { useContext, useRef, useState } from 'react';
import { IconButton, Tile } from '~/components/garis';
import { IconFoto } from '~/components/icons/foto';
import { IconHapus } from '~/components/icons/hapus';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconUnggah } from '~/components/icons/unggah';
import { fill } from '~/copy/fill';
import { isi } from '~/copy/isi';
import { PreviewMode, previewFile } from './preview';
import { uploadAnswerFile } from './upload';
import {
  fieldInfo,
  fileFits,
  fileName,
  PHOTO_FILE_TYPES,
  RELATIONS,
  tidyDate,
  type DraftValue,
  type SavedField,
} from './rules';

const PLACEHOLDER: Partial<Record<SavedField, string>> = {
  whatsapp: isi.contoh.whatsapp,
  line: isi.contoh.line,
  instagram: isi.contoh.instagram,
  address: isi.contoh.address,
  hometown: isi.contoh.hometown,
  health: isi.contoh.health,
  birthDate: isi.contoh.birthDate,
};

/**
 * The controls that fill one saved detail: one input, or the three parts of the emergency contact. The agreement
 * step uses it for a detail the member never gave or wants to correct, and Profil › Data diri to edit one.
 * `labelledBy` names the row's label; `describedBy` its error and note.
 */
export function DetailEditor({
  field,
  value,
  onChange,
  idp,
  labelledBy,
  describedBy,
  invalid,
  onEnter,
}: {
  field: SavedField;
  value: DraftValue;
  onChange: (v: DraftValue) => void;
  idp: string;
  labelledBy: string;
  describedBy: string;
  invalid: boolean;
  /** Enter in a one-line input (Data diri saves). */
  onEnter?: () => void;
}) {
  const kind = fieldInfo(field).kind;
  const aria = (part?: string) => ({
    'aria-labelledby': part ? `${labelledBy} ${part}` : labelledBy,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
  });
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  if (kind === 'contact') {
    const c = value as Exclude<DraftValue, string>;
    const k = isi.kontak;
    return (
      <>
        <div className="pf-part">
          <span className="t-cap text-fg-2" id={`${idp}-nama-l`}>
            {k.nama}
          </span>
          <input
            className="g-lf"
            type="text"
            data-pf="name"
            value={c.name}
            placeholder={isi.contoh.kontakNama}
            autoComplete="off"
            onChange={(e) => onChange({ ...c, name: e.target.value })}
            onKeyDown={enter}
            {...aria(`${idp}-nama-l`)}
          />
        </div>
        <div className="pf-part">
          <span className="t-cap text-fg-2" id={`${idp}-hub-l`}>
            {k.hubungan}
          </span>
          <div className="f-pick" role="radiogroup" {...aria(`${idp}-hub-l`)}>
            {RELATIONS.map((r) => (
              <label key={r}>
                <input
                  type="radio"
                  name={`${idp}-hub`}
                  value={r}
                  checked={c.relation === r}
                  onChange={() => onChange({ ...c, relation: r })}
                />
                {r}
              </label>
            ))}
          </div>
        </div>
        <div className="pf-part">
          <span className="t-cap text-fg-2" id={`${idp}-no-l`}>
            {k.nomor}
          </span>
          <input
            className="g-lf num"
            type="tel"
            inputMode="tel"
            data-pf="phone"
            value={c.phone}
            placeholder={isi.contoh.kontakNomor}
            autoComplete="off"
            onChange={(e) => onChange({ ...c, phone: e.target.value })}
            onKeyDown={enter}
            {...aria(`${idp}-no-l`)}
          />
        </div>
      </>
    );
  }
  const v = value as string;
  if (kind === 'file')
    return (
      <PhotoPicker
        value={v}
        onChange={onChange}
        labelledBy={labelledBy}
        describedBy={describedBy}
      />
    );
  if (kind === 'long')
    return (
      <textarea
        className="g-lf"
        rows={1}
        data-pf={field}
        value={v}
        placeholder={PLACEHOLDER[field]}
        onChange={(e) => onChange(e.target.value)}
        {...aria()}
      />
    );
  return (
    <input
      className={kind === 'text' ? 'g-lf' : 'g-lf num'}
      type={kind === 'tel' ? 'tel' : 'text'}
      inputMode={
        kind === 'tel' ? 'tel' : kind === 'date' ? 'numeric' : undefined
      }
      maxLength={kind === 'date' ? 10 : undefined}
      style={kind === 'date' ? { maxWidth: 160 } : undefined}
      data-pf={field}
      value={v}
      placeholder={PLACEHOLDER[field]}
      autoComplete="off"
      onChange={(e) =>
        onChange(kind === 'date' ? tidyDate(e.target.value) : e.target.value)
      }
      onKeyDown={enter}
      {...aria()}
    />
  );
}

/** Foto KTM and Foto diri: a JPG or PNG, uploaded when picked. */
function PhotoPicker({
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  labelledBy: string;
  describedBy: string;
}) {
  const t = isi.tanya;
  const input = useRef<HTMLInputElement>(null);
  const preview = useContext(PreviewMode);
  const [percent, setPercent] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const pick = async (file: File) => {
    setProblem(null);
    if (!fileFits(file, PHOTO_FILE_TYPES)) {
      setProblem(isi.dataDiri.fotoDitolak);
      return;
    }
    setPercent(0);
    try {
      onChange(
        preview
          ? previewFile(file)
          : await uploadAnswerFile(file, 'image', setPercent),
      );
    } catch {
      setProblem(t.fileGagal);
    } finally {
      setPercent(null);
    }
  };
  if (value)
    return (
      <div className="f-file has">
        <Tile>
          <IconFoto size={20} />
        </Tile>
        <span className="grow t-sub">{fileName(value)}</span>
        <IconButton
          label={fill(t.hapusFile, { nama: fileName(value) })}
          onClick={() => onChange('')}
        >
          <IconHapus size={20} />
        </IconButton>
      </div>
    );
  return (
    <>
      <input
        ref={input}
        className="f-file-in"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void pick(file);
        }}
      />
      <button
        type="button"
        className="f-file"
        data-pf="file"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        disabled={percent !== null}
        onClick={() => input.current?.click()}
      >
        <Tile>
          <IconUnggah size={20} />
        </Tile>
        <span>
          <span className="block t-sub">
            {percent !== null
              ? fill(t.mengunggah, { persen: percent })
              : t.pilihFile}
          </span>
          <span className="block t-cap text-fg-3">{isi.dataDiri.fotoHint}</span>
        </span>
      </button>
      {problem ? (
        <p className="g-err t-sm" role="alert">
          <IconPeringatan size={16} />
          {problem}
        </p>
      ) : null}
    </>
  );
}
