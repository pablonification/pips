import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { useEffect, useRef, type ReactNode } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import type { ProfileField } from '~/api/generated';
import {
  Button,
  LinkButton,
  toast,
  useMediaQuery,
  DESKTOP_QUERY,
} from '~/components/garis';
import { IconBagian } from '~/components/icons/bagian';
import { IconCabang } from '~/components/icons/cabang';
import { IconCentang } from '~/components/icons/centang';
import { IconKunci } from '~/components/icons/kunci';
import { IconTambah } from '~/components/icons/tambah';
import { PageTitle } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { KindIcon, kindName } from './kinds';
import { Grip } from './parts';
import { QuestionEditor } from './QuestionEditor';
import {
  asksFirst,
  duplicateQuestion,
  FIELD_GROUPS,
  fieldLabel,
  fixRules,
  inFieldOrder,
  isChoice,
  newQuestion,
  newSection,
  SENSITIVE_FIELDS,
  withKind,
  type BuilderItem,
  type QuestionItem,
  type QuestionKind,
} from './rules';
import { sortAnnouncements, verticalOnly } from './sorting';
import type { Builder } from './useBuilder';

export type AskBreaking = (
  ask: {
    kind: 'del' | 'type';
    q: QuestionItem;
    number: number;
    to?: QuestionKind;
  },
  go: () => void,
) => void;

interface Props {
  builder: Builder;
  responseCount: number;
  sel: string | null;
  setSel: (id: string | null) => void;
  /** Focus the title (a form just made). */
  focusTitle: boolean;
  askBreaking: AskBreaking;
  before?: ReactNode;
}

/**
 * Pertanyaan: the form as it will read, with one question open at a time. Questions and sections are one list, so a
 * question dragged past a section's title joins that section; nothing goes above the first title. Every move works
 * with the keyboard (the grip: Space, the arrows, Space; Escape puts it back) and is announced. On desktop the outline
 * beside it reorders too, and jumps to a question.
 */
export function QuestionsTab({
  builder,
  responseCount,
  sel,
  setSel,
  focusTitle,
  askBreaking,
  before,
}: Props) {
  const { methods } = builder;
  const desk = useMediaQuery(DESKTOP_QUERY);
  const list = useFieldArray({
    control: methods.control,
    name: 'items',
    keyName: 'fid',
  });
  const items = (useWatch({ control: methods.control, name: 'items' }) ??
    []) as BuilderItem[];
  const requested = (useWatch({
    control: methods.control,
    name: 'requestedFields',
  }) ?? []) as ProfileField[];
  const title = useWatch({ control: methods.control, name: 'title' }) ?? '';
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);
  // After a render that opened, added or moved a question: focus what the action left you on.
  useEffect(() => {
    const sel = focusAfter.current;
    if (!sel) return;
    focusAfter.current = null;
    document.querySelector<HTMLElement>(sel)?.focus({ preventScroll: false });
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const ids = items.map((x) => x.id);
  const qNumber = (i: number) =>
    items.slice(0, i + 1).filter((x) => x.kind === 'q').length;
  const sectionCount = items.filter((x) => x.kind === 'section').length;
  const place = (id: string) => Math.max(1, ids.indexOf(id));

  const settleRules = () => {
    const { items: fixed, dropped } = fixRules(methods.getValues('items'));
    if (dropped) {
      methods.setValue('items', fixed, { shouldDirty: true });
      toast.success(copy.susun.syaratDilepas);
    }
  };
  const moveTo = (from: number, to: number) => {
    const target = Math.max(1, Math.min(items.length - 1, to));
    if (from === target) return;
    list.move(from, target);
    settleRules();
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id).replace(/^ol:/, ''));
    const to = ids.indexOf(String(over.id).replace(/^ol:/, ''));
    moveTo(from, to);
  };
  const select = (id: string) => {
    setSel(id);
    focusAfter.current = desk ? `#fb-q-${id}-label` : `[data-grip="${id}"]`;
  };
  const addQuestion = () => {
    const q = newQuestion();
    const at = sel ? ids.indexOf(sel) + 1 : items.length;
    list.insert(at > 0 ? at : items.length, q);
    setSel(q.id);
    focusAfter.current = `#fb-q-${q.id}-label`;
  };
  const addSection = () => {
    const s = newSection();
    list.append(s);
    focusAfter.current = `[data-sec="${s.id}"]`;
  };
  const removeSection = (i: number) => {
    const kept = methods.getValues('items');
    const s = kept[i]!;
    list.remove(i);
    focusAfter.current = '[data-addq]';
    toast.success(copy.susun.bagianDihapus, {
      action: {
        label: common.komponen.urungkan,
        onClick: () => list.insert(i, s),
      },
    });
  };
  const deleteQuestion = (i: number, q: QuestionItem) => {
    const go = () => {
      const all = methods.getValues('items');
      const near =
        all.slice(i + 1).find((x) => x.kind === 'q') ??
        all
          .slice(0, i)
          .reverse()
          .find((x) => x.kind === 'q');
      list.remove(i);
      settleRules();
      setSel(near?.id ?? null);
      focusAfter.current = near ? `[data-grip="${near.id}"]` : '[data-addq]';
      return near;
    };
    if (asksFirst(responseCount, { kind: 'del', questionId: q.id }))
      askBreaking({ kind: 'del', q, number: qNumber(i) }, () => {
        builder.agreeBreaking();
        go();
        toast.success(copy.susun.dihapusJawaban);
      });
    else {
      go();
      toast.success(copy.susun.dihapus, {
        action: {
          label: common.komponen.urungkan,
          onClick: () => {
            list.insert(i, q);
            setSel(q.id);
          },
        },
      });
    }
  };
  const changeKind = (i: number, q: QuestionItem, kind: QuestionKind) => {
    if (kind === q.type) return;
    const go = () => {
      methods.setValue(`items.${i}` as never, withKind(q, kind) as never, {
        shouldDirty: true,
      });
      settleRules();
      focusAfter.current = `[data-ed="${q.id}"] .fb-type`;
    };
    if (
      asksFirst(
        responseCount,
        { kind: 'type', questionId: q.id, to: kind },
        q.type,
      )
    )
      askBreaking({ kind: 'type', q, number: qNumber(i), to: kind }, () => {
        builder.agreeBreaking();
        go();
        toast.success(copy.susun.jenisDiubah);
      });
    else go();
  };
  const nudge = (
    i: number,
    q: QuestionItem,
    field: ProfileField,
    has: boolean,
  ) => {
    const before = methods.getValues('requestedFields');
    const go = () => {
      list.remove(i);
      if (!has)
        methods.setValue('requestedFields', inFieldOrder([...before, field]), {
          shouldDirty: true,
        });
      settleRules();
      setSel(null);
      focusAfter.current = '[data-fields]';
      toast.success(
        has
          ? copy.susun.dihapus
          : fill(copy.nudge.diminta, { field: fieldLabel(field) }),
        {
          action: {
            label: common.komponen.urungkan,
            onClick: () => {
              list.insert(i, q);
              methods.setValue('requestedFields', before, {
                shouldDirty: true,
              });
              setSel(q.id);
            },
          },
        },
      );
    };
    if (asksFirst(responseCount, { kind: 'del', questionId: q.id }))
      askBreaking({ kind: 'del', q, number: qNumber(i) }, () => {
        builder.agreeBreaking();
        go();
      });
    else go();
  };

  return (
    <div className="fb-wrap">
      <div className="fb-canvas">
        {before}
        <div className="fb-head">
          <PageTitle display={false} className="fb-title-h">
            <textarea
              ref={titleRef}
              className="fb-lf fb-title"
              rows={1}
              value={title}
              onChange={(e) =>
                methods.setValue('title', e.target.value.replace(/\n/g, ' '), {
                  shouldDirty: true,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              placeholder={copy.susun.judulPlaceholder}
              aria-label={copy.susun.judulForm}
              maxLength={200}
            />
          </PageTitle>
          <textarea
            className="fb-lf fb-desc"
            rows={1}
            {...methods.register('description')}
            placeholder={copy.susun.deskripsiPlaceholder}
            aria-label={copy.susun.deskripsiForm}
            maxLength={2000}
          />
        </div>
        <div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[verticalOnly]}
            onDragEnd={onDragEnd}
            accessibility={sortAnnouncements(
              Math.max(0, items.length - 1),
              place,
            )}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="fb-items">
                {list.fields.map((f, i) => {
                  const it = items[i];
                  if (!it) return null;
                  if (it.kind === 'section')
                    return (
                      <SortableRow key={f.fid} id={it.id} fixed>
                        {() =>
                          i === 0 && sectionCount === 1 && !it.title ? null : (
                            <div className="fb-sec">
                              <input
                                className="fb-lf"
                                type="text"
                                data-sec={it.id}
                                value={it.title}
                                onChange={(e) =>
                                  methods.setValue(
                                    `items.${i}.title` as never,
                                    e.target.value as never,
                                    {
                                      shouldDirty: true,
                                    },
                                  )
                                }
                                placeholder={fill(copy.susun.bagianN, {
                                  nomor: sectionNumber(items, i),
                                })}
                                aria-label={fill(copy.susun.judulBagian, {
                                  nomor: sectionNumber(items, i),
                                })}
                                autoComplete="off"
                                maxLength={200}
                              />
                              {i > 0 ? (
                                <LinkButton onClick={() => removeSection(i)}>
                                  {copy.susun.hapusBagian}
                                </LinkButton>
                              ) : (
                                <span />
                              )}
                            </div>
                          )
                        }
                      </SortableRow>
                    );
                  const n = qNumber(i);
                  const open = sel === it.id;
                  return (
                    <SortableRow key={f.fid} id={it.id}>
                      {(grip) =>
                        open ? (
                          <QuestionEditor
                            index={i}
                            number={n}
                            q={it}
                            items={items}
                            requested={requested}
                            methods={methods}
                            grip={grip(
                              fill(copy.susun.pindahkanPertanyaan, {
                                nomor: n,
                              }),
                              20,
                              true,
                            )}
                            canMoveUp={i > 1}
                            canMoveDown={i < items.length - 1}
                            onKind={(k) => changeKind(i, it, k)}
                            onDelete={() => deleteQuestion(i, it)}
                            onDuplicate={() => {
                              const c = duplicateQuestion(it);
                              list.insert(i + 1, c);
                              setSel(c.id);
                              focusAfter.current = `#fb-q-${c.id}-label`;
                            }}
                            onMove={(dir) => {
                              moveTo(i, i + dir);
                              focusAfter.current = `[data-ed="${it.id}"] [aria-label="${copy.susun.lainnya}"]`;
                            }}
                            onNudge={(field, has) => nudge(i, it, field, has)}
                            onRulesChanged={settleRules}
                          />
                        ) : (
                          <div className="fb-q">
                            <span className="fb-n" aria-hidden="true">
                              {n}
                            </span>
                            <button
                              type="button"
                              className="fb-q-main"
                              data-q={it.id}
                              onClick={() => select(it.id)}
                            >
                              <QuestionSummary q={it} items={items} />
                            </button>
                            {grip(
                              fill(copy.susun.pindahkanPertanyaan, {
                                nomor: n,
                              }),
                              20,
                            )}
                          </div>
                        )
                      }
                    </SortableRow>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          <div className="fb-add">
            <Button
              size="sm"
              variant="paper"
              data-addq=""
              onClick={addQuestion}
              aria-label={copy.susun.tambahPertanyaanLabel}
            >
              <IconTambah size={16} />
              {copy.susun.tambahPertanyaan}
            </Button>
            <Button size="sm" variant="ghost" onClick={addSection}>
              <IconBagian size={16} />
              {copy.susun.bagianBaru}
            </Button>
          </div>
        </div>
        <FieldsPicker
          value={requested}
          onChange={(v) =>
            methods.setValue('requestedFields', inFieldOrder(v), {
              shouldDirty: true,
            })
          }
        />
      </div>
      {desk ? (
        <aside className="fb-out" aria-label={copy.susun.susunan}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[verticalOnly]}
            onDragEnd={onDragEnd}
            accessibility={sortAnnouncements(
              Math.max(0, items.length - 1),
              (id) => place(id.replace(/^ol:/, '')),
            )}
          >
            <SortableContext
              items={ids.map((id) => `ol:${id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="fb-ol">
                {items.map((it, i) =>
                  it.kind === 'section' ? (
                    <SortableRow key={it.id} id={`ol:${it.id}`} fixed>
                      {() =>
                        i === 0 && sectionCount === 1 && !it.title ? null : (
                          <div className="fb-ol-row sec">
                            {it.title ||
                              fill(copy.susun.bagianN, {
                                nomor: sectionNumber(items, i),
                              })}
                          </div>
                        )
                      }
                    </SortableRow>
                  ) : (
                    <SortableRow key={it.id} id={`ol:${it.id}`} outline>
                      {(grip) => (
                        <div
                          className={
                            sel === it.id ? 'fb-ol-row cur' : 'fb-ol-row'
                          }
                        >
                          {grip(
                            fill(copy.susun.pindahkan, {
                              judul: it.label || copy.susun.tanpaJudul,
                            }),
                            16,
                          )}
                          <span className="n" aria-hidden="true">
                            {qNumber(i)}
                          </span>
                          <button
                            type="button"
                            className="go"
                            aria-current={sel === it.id ? 'true' : undefined}
                            onClick={() => {
                              select(it.id);
                              requestAnimationFrame(() =>
                                document
                                  .querySelector(`[data-ed="${it.id}"]`)
                                  ?.scrollIntoView({ block: 'center' }),
                              );
                            }}
                          >
                            {it.label || copy.susun.tanpaJudul}
                          </button>
                        </div>
                      )}
                    </SortableRow>
                  ),
                )}
              </div>
            </SortableContext>
          </DndContext>
        </aside>
      ) : null}
    </div>
  );
}

const sectionNumber = (items: readonly BuilderItem[], i: number) =>
  items.slice(0, i + 1).filter((x) => x.kind === 'section').length;

type GripFor = (label: string, size: 16 | 20, editor?: boolean) => ReactNode;

/** One sortable row. A section title (`fixed`) is a place to drop, never dragged itself. */
function SortableRow({
  id,
  fixed = false,
  outline = false,
  children,
}: {
  id: string;
  fixed?: boolean;
  outline?: boolean;
  children: (grip: GripFor) => ReactNode;
}) {
  const s = useSortable({
    id,
    disabled: fixed ? { draggable: true, droppable: false } : undefined,
  });
  const bare = id.replace(/^ol:/, '');
  const grip: GripFor = (label, size) => (
    <Grip
      ref={s.setActivatorNodeRef}
      {...s.attributes}
      {...s.listeners}
      data-grip={outline ? undefined : bare}
      data-olgrip={outline ? bare : undefined}
      size={size}
      lifted={s.isDragging}
      label={label}
    />
  );
  const content = children(grip);
  return (
    <div
      ref={s.setNodeRef}
      className={
        outline ? undefined : s.isDragging ? 'fb-item dragging' : 'fb-item'
      }
      style={{
        transform: CSS.Translate.toString(s.transform),
        transition: s.transition,
      }}
      data-item={bare}
      hidden={content === null || undefined}
    >
      {content}
    </div>
  );
}

/** A question at rest: its wording, kind, option count, "opsional", and its rule in words. */
export function QuestionSummary({
  q,
  items,
  withOptions = false,
}: {
  q: QuestionItem;
  items: readonly BuilderItem[];
  withOptions?: boolean;
}) {
  const src = q.dependsOn
    ? items.find(
        (x): x is QuestionItem =>
          x.kind === 'q' && x.id === q.dependsOn!.questionId,
      )
    : undefined;
  const parts: ReactNode[] = [
    <span key="k" className="inline-flex items-center gap-1">
      <KindIcon kind={q.type} size={16} />
      {kindName(q.type)}
    </span>,
  ];
  if (isChoice(q.type))
    parts.push(
      fill(copy.susun.opsiJumlah, {
        jumlah: q.options.length + (q.other ? 1 : 0),
      }),
    );
  if (!q.required) parts.push(copy.susun.opsional);
  return (
    <>
      <span className={q.label ? 't' : 't none'}>
        {q.label || copy.susun.tanpaJudul}
      </span>
      <span className="fb-meta">
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {i ? (
              <span className="sep" aria-hidden="true">
                ·
              </span>
            ) : null}
            {p}
          </span>
        ))}
      </span>
      {withOptions && isChoice(q.type) ? (
        <span className="fb-meta">
          {[
            ...q.options.map((o) => o.value),
            ...(q.other ? [copy.susun.lainnya] : []),
          ].join(' · ')}
        </span>
      ) : null}
      {src && q.dependsOn ? (
        <span className="fb-rule-line">
          <IconCabang size={16} />
          <span>
            {fill(copy.susun.munculJika, {
              pertanyaan: src.label,
              jawaban: q.dependsOn.value,
            })}
          </span>
        </span>
      ) : null}
    </>
  );
}

/** "Ikut terkirim dari profil anggota": every field a tick, in its group; sensitive ones say so. */
function FieldsPicker({
  value,
  onChange,
}: {
  value: readonly ProfileField[];
  onChange: (v: ProfileField[]) => void;
}) {
  return (
    <section
      className="fb-fields"
      aria-labelledby="fb-fields-t"
      tabIndex={-1}
      data-fields=""
    >
      <h2 className="t-heading" id="fb-fields-t">
        {copy.profil.judul}
      </h2>
      <p className="t-sm text-fg-2">{copy.profil.isi}</p>
      <div>
        {FIELD_GROUPS.map(([g, fields]) => (
          <div
            key={g}
            className="fb-fgrp"
            role="group"
            aria-labelledby={`fb-fg-${g}`}
          >
            <h3 className="t-label" id={`fb-fg-${g}`}>
              {copy.profil.grup[g]}
            </h3>
            <div className="fb-ticks">
              {fields.map((f) => (
                <label key={f} className="fb-tick">
                  <input
                    type="checkbox"
                    checked={value.includes(f)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...value, f]
                          : value.filter((x) => x !== f),
                      )
                    }
                  />
                  <span className="fb-key" aria-hidden="true">
                    <i />
                    <IconCentang size={16} />
                  </span>
                  <span className="l">
                    {fieldLabel(f)}
                    {SENSITIVE_FIELDS.includes(f) ? (
                      <span className="fb-sens">
                        <IconKunci size={16} />
                        {copy.profil.sensitif}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
