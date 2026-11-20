// The builder itself, loaded beside its form's data (BuilderScreen).
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { ApiError, type ManageForm, type UpdateForm } from '~/api/generated';
import {
  Button,
  DESKTOP_QUERY,
  IconButton,
  Seg,
  Tag,
  toast,
  useMediaQuery,
} from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconGrup } from '~/components/icons/grup';
import { IconKelola } from '~/components/icons/kelola';
import { IconMata } from '~/components/icons/mata';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTautan } from '~/components/icons/tautan';
import { TopBarActions } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { AnswersTab } from './AnswersTab';
import { BreakingDialog, PublishDialog, PublishedDialog } from './Dialogs';
import { copyLink, MakerStatus } from './parts';
import { manageFormQuery } from './data';
import { keepForm, publishForm, updateForm } from './queries';
import { QuestionsTab, type AskBreaking } from './QuestionsTab';
import { ReadOnlyQuestions } from './ReadOnlyQuestions';
import { SettingsTab } from './SettingsTab';
import { ShareDialog } from './ShareDialog';
import { useBuilder, type SaveState } from './useBuilder';
import type { BuilderItem, QuestionKind } from './rules';
import '~/styles/garis/form-builder.css';

import type { BuilderTab } from './BuilderScreen';

interface Props {
  formId: string;
  tab: BuilderTab | undefined;
  lihat: 'satu' | undefined;
  no: number | undefined;
}

export function Builder({
  form,
  tab: wanted,
  lihat,
  no,
}: Props & { form: ManageForm }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const editable = form.access.canEdit;
  const builder = useBuilder(form, editable);
  const items = (useWatch({
    control: builder.methods.control,
    name: 'items',
  }) ?? []) as BuilderItem[];
  const baru = useRouterState({
    select: (s) => !!(s.location.state as { baru?: boolean }).baru,
  });
  const [sel, setSel] = useState<string | null>(() =>
    baru ? (form.sections[0]?.questions[0]?.id ?? null) : null,
  );
  const [settingsState, setSettingsState] = useState<SaveState>('saved');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [sharing, setSharing] = useState<false | 'share' | 'link'>(false);
  const [ask, setAsk] = useState<{
    kind: 'del' | 'type';
    label: string;
    number: number;
    from?: QuestionKind;
    to?: QuestionKind;
    go: () => void;
  } | null>(null);

  // A viewer lands on Jawaban and has no Setelan; Pertanyaan is theirs to look at.
  const tab: BuilderTab = editable
    ? (wanted ?? 'pertanyaan')
    : wanted === 'pertanyaan'
      ? 'pertanyaan'
      : 'jawaban';
  const goTab = (t: BuilderTab) =>
    void navigate({
      to: '/kelola/form/$formId',
      params: { formId: form.id },
      search: t === (editable ? 'pertanyaan' : 'jawaban') ? {} : { tab: t },
      replace: true,
    });

  const save: (body: UpdateForm) => Promise<boolean> = async (body) => {
    setSettingsState('saving');
    try {
      keepForm(client, await updateForm(form.id, body));
      setSettingsState('saved');
      return true;
    } catch (e) {
      setSettingsState('error');
      toast.error(
        e instanceof ApiError && e.status === 400
          ? copy.setelan.gagal
          : copy.setelan.gagal,
      );
      return false;
    }
  };
  const askBreaking: AskBreaking = (a, go) =>
    setAsk({
      kind: a.kind,
      label: a.q.label,
      number: a.number,
      from: a.q.type,
      to: a.to,
      go,
    });

  const state: SaveState =
    builder.state === 'error' || settingsState === 'error'
      ? 'error'
      : builder.state === 'saving' || settingsState === 'saving'
        ? 'saving'
        : 'saved';
  const stateMark = (
    <span
      className={state === 'error' ? 'fb-state bad' : 'fb-state'}
      role="status"
    >
      {state === 'error' ? (
        <>
          <IconPeringatan size={16} />
          {copy.bar.gagalSimpan}
        </>
      ) : state === 'saving' ? (
        copy.bar.menyimpan
      ) : (
        <>
          <IconCentang size={16} />
          {copy.bar.tersimpan}
        </>
      )}
    </span>
  );
  const preview = async () => {
    if (editable) await builder.flush();
    void navigate({
      to: '/kelola/form/$formId/pratinjau',
      params: { formId: form.id },
    });
  };
  const copyBar = async () => {
    toast.success(
      (await copyLink(form.slug))
        ? copy.tautan.disalinToast
        : copy.tautan.gagalSalin,
    );
  };
  const viewOnly = (
    <Tag icon={<IconMata size={16} />}>{copy.bar.lihatSaja}</Tag>
  );
  const publishOrState = form.publishedAt ? (
    <MakerStatus status={form.status} />
  ) : (
    <Button
      variant="gold"
      size="sm"
      onClick={() => setPublishing(true)}
      data-publish=""
    >
      {copy.bar.terbitkan}
    </Button>
  );

  const tabs = (
    <Seg
      label={copy.bar.bagian}
      value={tab}
      onChange={goTab}
      options={[
        { value: 'pertanyaan', label: copy.bar.pertanyaan },
        {
          value: 'jawaban',
          label: form.publishedAt ? (
            <>
              {copy.bar.jawaban}{' '}
              <span className="text-fg-3 num">{form.responseCount}</span>
            </>
          ) : (
            copy.bar.jawaban
          ),
        },
        ...(editable
          ? [{ value: 'setelan' as const, label: copy.bar.setelan }]
          : []),
      ]}
    />
  );
  const before = form.access.asAdmin ? (
    <p className="fb-as">
      <IconKelola size={16} />
      <span>
        {fill(copy.bar.milikAdmin, { nama: form.owner?.fullName ?? '' })}
      </span>
    </p>
  ) : null;

  return (
    <div className="fb">
      {desk ? null : (
        <TopBarActions>
          <span className="fb-top">
            {editable ? stateMark : viewOnly}
            <span className="grow" />
            {editable ? (
              <IconButton
                label={copy.bar.bagikanForm}
                onClick={() => setSharing('share')}
              >
                <IconGrup />
              </IconButton>
            ) : form.publishedAt ? (
              <IconButton
                label={copy.bar.salinTautanForm}
                onClick={() => void copyBar()}
              >
                <IconTautan />
              </IconButton>
            ) : null}
            <IconButton
              label={copy.bar.pratinjau}
              onClick={() => void preview()}
            >
              <IconMata />
            </IconButton>
            {editable ? publishOrState : <MakerStatus status={form.status} />}
          </span>
        </TopBarActions>
      )}
      <div className="fb-bar">
        {tabs}
        {desk ? (
          <>
            <span className="grow" />
            {editable ? (
              <>
                {stateMark}
                {state === 'error' ? (
                  <Button variant="ghost" size="sm" onClick={builder.retry}>
                    {copy.bar.simpanLagi}
                  </Button>
                ) : null}
                <Button
                  variant="paper"
                  size="sm"
                  onClick={() => setSharing('share')}
                >
                  <IconGrup size={16} />
                  {copy.bar.bagikan}
                </Button>
              </>
            ) : (
              <>
                {viewOnly}
                {form.publishedAt ? (
                  <Button
                    variant="paper"
                    size="sm"
                    onClick={() => void copyBar()}
                  >
                    <IconTautan size={16} />
                    {copy.bar.salinTautan}
                  </Button>
                ) : null}
              </>
            )}
            <Button variant="paper" size="sm" onClick={() => void preview()}>
              <IconMata size={16} />
              {copy.bar.pratinjau}
            </Button>
            {editable ? publishOrState : <MakerStatus status={form.status} />}
          </>
        ) : null}
      </div>
      {tab === 'jawaban' ? (
        <AnswersTab
          form={form}
          view={lihat === 'satu' ? 'satu' : 'ringkasan'}
          at={no ?? 1}
          before={before}
        />
      ) : tab === 'setelan' && editable ? (
        <SettingsTab form={form} save={save} before={before} />
      ) : editable ? (
        <QuestionsTab
          builder={builder}
          responseCount={form.publishedAt ? form.responseCount : 0}
          sel={sel}
          setSel={setSel}
          focusTitle={baru}
          askBreaking={askBreaking}
          before={before}
        />
      ) : (
        <ReadOnlyQuestions form={form} before={before} />
      )}
      {editable ? (
        <>
          <PublishDialog
            form={form}
            items={items}
            open={publishing}
            onOpenChange={setPublishing}
            onSettings={() => {
              setPublishing(false);
              goTab('setelan');
            }}
            onPublish={async () => {
              await builder.flush();
              try {
                keepForm(client, await publishForm(form.id));
              } catch (e) {
                void client.invalidateQueries({
                  queryKey: manageFormQuery(form.id).queryKey,
                });
                throw e;
              }
              setPublishing(false);
              setPublished(true);
            }}
          />
          <PublishedDialog
            form={form}
            open={published}
            onOpenChange={setPublished}
            onEditLink={() => {
              setPublished(false);
              setSharing('link');
            }}
          />
          <ShareDialog
            form={form}
            open={!!sharing}
            onOpenChange={(o) => setSharing(o ? 'share' : false)}
            startEditing={sharing === 'link'}
          />
          <BreakingDialog
            formId={form.id}
            ask={
              ask ??
              (builder.refusal
                ? refusalAsk(builder.refusal.breaking[0], items)
                : null)
            }
            responseCount={builder.refusal?.responseCount ?? form.responseCount}
            onCancel={() => {
              if (ask) setAsk(null);
              else builder.resolveRefusal(false);
            }}
            onConfirm={() => {
              if (ask) {
                ask.go();
                setAsk(null);
              } else builder.resolveRefusal(true);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** The question a refused edit was about, as the confirmation quotes it. */
function refusalAsk(
  b:
    | { questionId: string; label: string; change: 'removed' | 'type' }
    | undefined,
  items: readonly BuilderItem[],
) {
  const qs = items.filter((x) => x.kind === 'q');
  const i = qs.findIndex((q) => q.id === b?.questionId);
  const now = qs[i];
  return {
    kind: b?.change === 'type' ? ('type' as const) : ('del' as const),
    label: b?.label ?? '',
    number: i >= 0 ? i + 1 : qs.length + 1,
    to: now && now.kind === 'q' ? now.type : undefined,
  };
}
