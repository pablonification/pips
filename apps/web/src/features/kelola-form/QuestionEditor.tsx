import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import type { ProfileField } from '~/api/generated';
import {
  Button,
  IconButton,
  LinkButton,
  Menu,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  Switch,
  toast,
} from '~/components/garis';
import { IconAtas } from '~/components/icons/atas';
import { IconBawah } from '~/components/icons/bawah';
import { IconCabang } from '~/components/icons/cabang';
import { IconHapus } from '~/components/icons/hapus';
import { IconLainnya } from '~/components/icons/lainnya';
import { IconParagraf } from '~/components/icons/paragraf';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconProfil } from '~/components/icons/profil';
import { IconSalin } from '~/components/icons/salin';
import { IconTambah } from '~/components/icons/tambah';
import { IconTutup } from '~/components/icons/tutup';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { KindIcon, kindName } from './kinds';
import { Grip } from './parts';
import {
  earlierChoices,
  fieldLabel,
  isChoice,
  KIND_GROUPS,
  nudgeFor,
  offersOther,
  repeatedOptions,
  type BuilderItem,
  type QuestionItem,
  type QuestionKind,
} from './rules';
import { sortAnnouncements, verticalOnly } from './sorting';
import type { BuilderValues } from './useBuilder';

interface Props {
  index: number;
  number: number;
  q: QuestionItem;
  items: BuilderItem[];
  requested: ProfileField[];
  methods: UseFormReturn<BuilderValues>;
  grip: React.ReactNode;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onKind: (kind: QuestionKind) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onNudge: (field: ProfileField, has: boolean) => void;
  onRulesChanged: () => void;
}

/** One question, open: its wording, kind, answers, rule and actions. Only the chosen question opens. */
export function QuestionEditor({
  index,
  number,
  q,
  items,
  requested,
  methods,
  grip,
  canMoveUp,
  canMoveDown,
  onKind,
  onDelete,
  onDuplicate,
  onMove,
  onNudge,
  onRulesChanged,
}: Props) {
  const base = `items.${index}` as const;
  const set = (path: string, value: unknown) =>
    methods.setValue(`${base}.${path}` as never, value as never, {
      shouldDirty: true,
    });
  const options = useFieldArray({
    control: methods.control,
    name: `${base}.options` as never,
    keyName: 'fid',
  });
  const repeated = repeatedOptions(q);
  const id = `fb-q-${q.id}`;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const optionIds = options.fields.map(
    (f) => (f as unknown as { fid: string }).fid,
  );
  const onOptionDrag = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    options.move(
      optionIds.indexOf(String(active.id)),
      optionIds.indexOf(String(over.id)),
    );
  };
  const renameOption = (i: number, value: string) => {
    const was = q.options[i]?.value;
    set(`options.${i}.value`, value);
    // A rule that named this option follows its new words.
    const all = methods.getValues('items');
    all.forEach((x, j) => {
      if (
        x.kind === 'q' &&
        x.dependsOn?.questionId === q.id &&
        x.dependsOn.value === was
      )
        methods.setValue(`items.${j}.dependsOn.value` as never, value as never);
    });
  };

  const sources = earlierChoices(items, q.id);
  const source = q.dependsOn
    ? sources.find((s) => s.id === q.dependsOn!.questionId)
    : undefined;
  const nudge = nudgeFor(q.label);
  const nudgeHas = nudge ? requested.includes(nudge) : false;

  return (
    <div className="fb-ed" data-ed={q.id}>
      {grip}
      <div className="fb-ed-top">
        <span className="fb-n lit" aria-hidden="true">
          {number}
        </span>
        <input
          className="fb-lf"
          type="text"
          id={`${id}-label`}
          value={q.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder={copy.susun.pertanyaanPlaceholder}
          aria-label={fill(copy.susun.pertanyaanN, { nomor: number })}
          autoComplete="off"
          maxLength={500}
        />
        <Menu
          className="fb-menu"
          align="end"
          trigger={
            <button
              type="button"
              className="fb-type"
              aria-label={fill(copy.susun.jenisDari, {
                jenis: kindName(q.type),
              })}
            >
              <KindIcon kind={q.type} size={20} />
              {kindName(q.type)}
              <span className="c">
                <IconBawah size={16} />
              </span>
            </button>
          }
        >
          <MenuRadioGroup
            value={q.type}
            onValueChange={(v) => onKind(v as QuestionKind)}
            label={copy.susun.jenis}
          >
            {KIND_GROUPS.map((group, g) => (
              <div key={g} role="none">
                {g ? <MenuSeparator /> : null}
                {group.map((k) => (
                  <MenuRadioItem
                    key={k}
                    value={k}
                    icon={<KindIcon kind={k} size={20} />}
                  >
                    {kindName(k)}
                  </MenuRadioItem>
                ))}
              </div>
            ))}
          </MenuRadioGroup>
        </Menu>
      </div>
      {q.description !== undefined ? (
        <input
          className="fb-lf fb-hint-field"
          type="text"
          value={q.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={copy.susun.deskripsiPlaceholder}
          aria-label={copy.susun.deskripsiPertanyaan}
          autoComplete="off"
          data-hint-field=""
        />
      ) : null}
      <div className="fb-ed-body">
        {isChoice(q.type) ? (
          <div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[verticalOnly]}
              onDragEnd={onOptionDrag}
              accessibility={sortAnnouncements(
                optionIds.length,
                (oid) => optionIds.indexOf(oid) + 1,
              )}
            >
              <SortableContext
                items={optionIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="fb-opts">
                  {options.fields.map((f, i) => (
                    <OptionRow
                      key={optionIds[i]}
                      sortId={optionIds[i]!}
                      index={i}
                      value={q.options[i]?.value ?? ''}
                      kind={q.type}
                      repeated={repeated.includes(i)}
                      only={q.options.length < 2}
                      onChange={(v) => renameOption(i, v)}
                      onEnter={() => {
                        options.insert(i + 1, { value: '' } as never);
                        requestAnimationFrame(() =>
                          document
                            .querySelector<HTMLInputElement>(
                              `[data-opt="${q.id}-${i + 1}"]`,
                            )
                            ?.focus(),
                        );
                      }}
                      onRemove={() => {
                        options.remove(i);
                        onRulesChanged();
                        requestAnimationFrame(() =>
                          document
                            .querySelector<HTMLElement>(
                              `[data-optadd="${q.id}"]`,
                            )
                            ?.focus(),
                        );
                      }}
                      qid={q.id}
                    />
                  ))}
                  {q.other && offersOther(q.type) ? (
                    <div className="fb-opt">
                      <span />
                      <span
                        className={q.type === 'checkbox' ? 'mk sq' : 'mk'}
                        aria-hidden="true"
                      />
                      <span className="fix">{copy.susun.lainnyaTulis}</span>
                      <IconButton
                        size="sm"
                        label={copy.susun.hapusLainnya}
                        onClick={() => set('other', false)}
                      >
                        <IconTutup size={16} />
                      </IconButton>
                    </div>
                  ) : null}
                </div>
              </SortableContext>
            </DndContext>
            <div className="fb-opt-add">
              <LinkButton
                data-optadd={q.id}
                onClick={() => {
                  options.append({ value: '' } as never);
                  const at = q.options.length;
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLInputElement>(
                        `[data-opt="${q.id}-${at}"]`,
                      )
                      ?.focus(),
                  );
                }}
              >
                <IconTambah size={16} />
                {copy.susun.tambahOpsi}
              </LinkButton>
              {!q.other && offersOther(q.type) ? (
                <>
                  <span>{copy.susun.atau}</span>
                  <LinkButton onClick={() => set('other', true)}>
                    {copy.susun.tambahLainnya}
                  </LinkButton>
                </>
              ) : null}
            </div>
          </div>
        ) : q.type === 'rating' ? (
          <div className="fb-scale">
            <div className="fb-rule plain">
              <span>{copy.susun.dari}</span>
              <span className="fb-sel num">
                <select
                  className="fb-lf"
                  value={q.scale.min}
                  onChange={(e) => set('scale.min', Number(e.target.value))}
                  aria-label={copy.susun.angkaTerendah}
                >
                  {[0, 1].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <IconBawah size={16} />
              </span>
              <span>{copy.susun.sampai}</span>
              <span className="fb-sel num">
                <select
                  className="fb-lf"
                  value={q.scale.max}
                  onChange={(e) => set('scale.max', Number(e.target.value))}
                  aria-label={copy.susun.angkaTertinggi}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <IconBawah size={16} />
              </span>
            </div>
            <div className="fb-two">
              {(['minLabel', 'maxLabel'] as const).map((k) => {
                const angka = k === 'minLabel' ? q.scale.min : q.scale.max;
                return (
                  <input
                    key={k}
                    className="fb-lf"
                    type="text"
                    value={q.scale[k]}
                    onChange={(e) => set(`scale.${k}`, e.target.value)}
                    placeholder={fill(copy.susun.artiAngkaOpsional, { angka })}
                    aria-label={fill(copy.susun.artiAngka, { angka })}
                    autoComplete="off"
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <p className="fb-ghost">
            {copy.susun.ghost[q.type as keyof typeof copy.susun.ghost]}
          </p>
        )}
        {nudge ? (
          <div className="fb-nudge">
            <IconProfil size={20} />
            <span className="grow">
              {fill(
                nudgeHas ? copy.nudge.sudahDiminta : copy.nudge.adaDiProfil,
                {
                  field: fieldLabel(nudge),
                },
              )}
            </span>
            <Button
              size="sm"
              variant="paper"
              onClick={() => onNudge(nudge, nudgeHas)}
            >
              {nudgeHas
                ? copy.nudge.hapusPertanyaan
                : copy.nudge.mintaDariProfil}
            </Button>
          </div>
        ) : null}
        {q.dependsOn && source ? (
          <div className="fb-rule">
            <IconCabang size={20} />
            <span>{copy.susun.tampilkanJika}</span>
            <span className="fb-sel">
              <select
                className="fb-lf"
                data-rule="q"
                value={source.id}
                aria-label={copy.susun.pertanyaanPenentu}
                onChange={(e) => {
                  const next = sources.find((s) => s.id === e.target.value)!;
                  set('dependsOn', {
                    questionId: next.id,
                    value:
                      next.options.find((o) => o.value.trim())?.value ?? '',
                  });
                }}
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label || copy.susun.tanpaJudul}
                  </option>
                ))}
              </select>
              <IconBawah size={16} />
            </span>
            <span>{copy.susun.dijawab}</span>
            <span className="fb-sel">
              <select
                className="fb-lf"
                data-rule="is"
                value={q.dependsOn.value}
                aria-label={copy.susun.jawabanPenentu}
                onChange={(e) => set('dependsOn.value', e.target.value)}
              >
                {source.options
                  .filter((o) => o.value.trim())
                  .map((o) => (
                    <option key={o.value}>{o.value}</option>
                  ))}
              </select>
              <IconBawah size={16} />
            </span>
            <IconButton
              size="sm"
              label={copy.susun.hapusSyarat}
              data-rule-del=""
              onClick={() => {
                set('dependsOn', null);
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>(`[data-rule-add="${q.id}"]`)
                    ?.focus(),
                );
              }}
            >
              <IconTutup size={16} />
            </IconButton>
          </div>
        ) : null}
      </div>
      <div className="fb-foot">
        <span className="req">
          <Switch
            checked={q.required}
            onCheckedChange={(v) => set('required', v)}
            aria-labelledby={`${id}-req`}
          />
          <span id={`${id}-req`}>{copy.susun.wajib}</span>
        </span>
        <span className="acts">
          {q.dependsOn ? null : (
            <Button
              variant="ghost"
              size="sm"
              data-rule-add={q.id}
              onClick={() => {
                const src = sources.at(-1);
                const value = src?.options.find((o) => o.value.trim())?.value;
                if (!src || value === undefined) {
                  toast.success(copy.susun.perluPenentu);
                  return;
                }
                set('dependsOn', { questionId: src.id, value });
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>(
                      `[data-ed="${q.id}"] [data-rule="is"]`,
                    )
                    ?.focus(),
                );
              }}
            >
              <IconCabang size={16} />
              {copy.susun.tampilkanJika}
            </Button>
          )}
          <IconButton
            label={copy.susun.duplikat}
            title={copy.susun.duplikat}
            onClick={onDuplicate}
          >
            <IconSalin size={20} />
          </IconButton>
          <IconButton
            label={copy.susun.hapus}
            title={copy.susun.hapus}
            onClick={onDelete}
            data-del={q.id}
          >
            <IconHapus size={20} />
          </IconButton>
          <Menu
            align="end"
            trigger={
              <IconButton label={copy.susun.lainnya}>
                <IconLainnya size={20} />
              </IconButton>
            }
          >
            <MenuItem
              icon={<IconParagraf size={20} />}
              onSelect={() => {
                set(
                  'description',
                  q.description === undefined ? '' : undefined,
                );
                if (q.description === undefined)
                  setTimeout(() =>
                    document
                      .querySelector<HTMLElement>(
                        `[data-ed="${q.id}"] [data-hint-field]`,
                      )
                      ?.focus(),
                  );
              }}
            >
              {q.description === undefined
                ? copy.susun.tambahDeskripsi
                : copy.susun.hapusDeskripsi}
            </MenuItem>
            <MenuItem
              icon={<IconAtas size={20} />}
              disabled={!canMoveUp}
              onSelect={() => canMoveUp && onMove(-1)}
            >
              {copy.susun.pindahAtas}
            </MenuItem>
            <MenuItem
              icon={<IconBawah size={20} />}
              disabled={!canMoveDown}
              onSelect={() => canMoveDown && onMove(1)}
            >
              {copy.susun.pindahBawah}
            </MenuItem>
          </Menu>
        </span>
      </div>
    </div>
  );
}

function OptionRow({
  sortId,
  index,
  value,
  kind,
  repeated,
  only,
  qid,
  onChange,
  onEnter,
  onRemove,
}: {
  sortId: string;
  index: number;
  value: string;
  kind: QuestionKind;
  repeated: boolean;
  only: boolean;
  qid: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  onRemove: () => void;
}) {
  const s = useSortable({ id: sortId });
  const errId = `fb-opt-${qid}-${index}-err`;
  return (
    <div
      ref={s.setNodeRef}
      className={s.isDragging ? 'fb-opt dragging' : 'fb-opt'}
      style={{
        transform: CSS.Translate.toString(s.transform),
        transition: s.transition,
      }}
    >
      <Grip
        ref={s.setActivatorNodeRef}
        {...s.attributes}
        {...s.listeners}
        size={16}
        lifted={s.isDragging}
        label={fill(copy.susun.pindahkanOpsi, {
          opsi: value || String(index + 1),
        })}
      />
      {kind === 'dropdown' ? (
        <span className="num" aria-hidden="true">
          {index + 1}
        </span>
      ) : (
        <span
          className={kind === 'checkbox' ? 'mk sq' : 'mk'}
          aria-hidden="true"
        />
      )}
      <input
        className="fb-lf"
        type="text"
        value={value}
        data-opt={`${qid}-${index}`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={fill(copy.susun.opsiN, { nomor: index + 1 })}
        aria-label={fill(copy.susun.opsiN, { nomor: index + 1 })}
        aria-invalid={repeated || undefined}
        aria-describedby={repeated ? errId : undefined}
        autoComplete="off"
        maxLength={200}
      />
      <IconButton
        size="sm"
        label={fill(copy.susun.hapusOpsi, { opsi: value || String(index + 1) })}
        aria-disabled={only || undefined}
        onClick={() => {
          if (!only) onRemove();
        }}
      >
        <IconTutup size={16} />
      </IconButton>
      {repeated ? (
        <p className="fb-opt-err" id={errId}>
          <IconPeringatan size={16} />
          {copy.susun.opsiSama}
        </p>
      ) : null}
    </div>
  );
}
