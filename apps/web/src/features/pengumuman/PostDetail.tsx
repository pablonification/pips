/**
 * A post (`postDetail`): byline, title, text with its links, link cards, photos, categories with the audience,
 * reactions and comments. On phones and tablets it is the page (its title the page's h1, share and the menu in the
 * top bar); on desktop the pane beside the list (the menu in the byline, no share).
 */
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import type { CommentWithReactions, Info } from '~/api/generated';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Input,
  LinkButton,
  PixelReaction,
  ReactionButton,
  Reactions,
  Tag,
  toast,
} from '~/components/garis';
import { IconBagikan } from '~/components/icons/bagikan';
import { IconGrup } from '~/components/icons/grup';
import { IconKirim } from '~/components/icons/kirim';
import { IconProfil } from '~/components/icons/profil';
import { IconReaksi } from '~/components/icons/reaksi';
import { IconButton } from '~/components/garis';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { pengumuman as t } from '~/copy/pengumuman';
import { PageTitle, TopBarActions } from '~/components/shell/page';
import useSession from '~/hooks/auth/useSession';
import { can } from '~/lib/capabilities';
import { dFull, rel } from '~/lib/dates';
import { initialsOf } from '~/lib/shell/names';
import { cn } from '~/lib/utils';
import {
  useComments,
  useDeleteComment,
  usePostComment,
  useReact,
} from './data';
import {
  Linkified,
  LinkCards,
  Photos,
  ReactionPicker,
  sharePost,
  useDismiss,
  postName,
} from './parts';
import { useReactTo } from './PostCard';
import { PostMenu } from './PostMenu';
import {
  audText,
  chipLabel,
  commentReactLabel,
  myReaction,
  nextReaction,
  reactionCounts,
  reactionLabel,
  displayText,
} from './rules';
import { useNow } from './useNow';
import { focusSoon, type FeedSearch } from './view';

export const COMMENT_FIELD = 'komentar';

export function PostDetail({
  info,
  desk,
  search,
}: {
  info: Info;
  desk: boolean;
  search: FeedSearch;
}) {
  const me = useSession();
  const own = info.creatorId === me.id;
  const name = info.creator.fullName;
  const title = info.title ? (
    desk ? (
      <h2 className="t-title" data-post-title="">
        {info.title}
      </h2>
    ) : (
      <PageTitle display={false} className="t-title">
        {info.title}
      </PageTitle>
    )
  ) : desk ? (
    <h2 className="sr-only">{fill(t.post.dari, { nama: name })}</h2>
  ) : (
    <PageTitle display={false} className="sr-only">
      {fill(t.post.dari, { nama: name })}
    </PageTitle>
  );
  return (
    <article
      className={cn('g-detail', desk && 'desk')}
      aria-label={postName(info)}
    >
      {desk ? null : (
        <TopBarActions>
          <IconButton
            label={t.feed.bagikan}
            onClick={() => void sharePost(info)}
          >
            <IconBagikan size={24} />
          </IconButton>
          <PostMenu info={info} size="md" leaveTo={{ search }} />
        </TopBarActions>
      )}
      <div className="g-byline">
        <Avatar initials={initialsOf(name)} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="t-label">
            <b>{name}</b>
            {own ? <Tag className="ml-1">{t.feed.kamu}</Tag> : null}
          </p>
          <p className="t-cap text-fg-3 num">{dFull(info.createdAt)}</p>
        </div>
        {desk ? <PostMenu info={info} leaveTo={{ search }} /> : null}
      </div>
      {title}
      <div className="g-prose t-body">
        <Linkified text={displayText(info.content)} />
      </div>
      <LinkCards info={info} />
      <Photos medias={info.infoMedias ?? []} />
      <div className="g-tags-aud">
        <div className="g-post-tags">
          {info.infoCategories?.map((c) => (
            <Tag key={c.categoryId}>{c.category.name}</Tag>
          ))}
        </div>
        <p className="g-aud">
          {info.infoAngkatan?.length ? (
            <IconProfil size={16} />
          ) : (
            <IconGrup size={16} />
          )}
          {audText(info)}
        </p>
      </div>
      <PostReactions info={info} />
      <CommentsSection info={info} level={desk ? 'h3' : 'h2'} />
    </article>
  );
}

function PostReactions({ info }: { info: Info }) {
  const mine = myReaction(info.reactions);
  const [picking, setPicking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const reactTo = useReactTo(info);
  const close = useCallback((back: boolean) => {
    setPicking(false);
    if (back) trigger.current?.focus();
  }, []);
  useDismiss(picking, close, [picker, trigger]);
  return (
    <div className="g-reactions" role="group" aria-label={t.reaksi.grup}>
      <Reactions>
        {reactionCounts(info.reactions)
          .filter((r) => r.count > 0)
          .map((r) => (
            <ReactionButton
              key={r.key}
              reaction={r.key}
              count={r.count}
              mine={mine === r.key}
              label={chipLabel(r.key, r.count, mine === r.key)}
              data-reaction={r.key}
              onClick={(e) => {
                const btn = e.currentTarget;
                reactTo(r.key);
                focusSoon(() =>
                  btn.isConnected
                    ? btn
                    : (btn
                        .closest('.g-reactions')
                        ?.querySelector<HTMLElement>(
                          `[data-reaction="${r.key}"]`,
                        ) ?? trigger.current),
                );
              }}
            />
          ))}
        <button
          ref={trigger}
          type="button"
          className="g-react"
          aria-expanded={picking}
          onClick={() => setPicking((o) => !o)}
        >
          <IconReaksi size={20} />
          <span>{mine ? t.reaksi.ganti : t.reaksi.beri}</span>
        </button>
      </Reactions>
      {picking ? (
        <ReactionPicker
          pickerRef={picker}
          mine={mine}
          onPick={(k) => {
            reactTo(k);
            close(true);
          }}
        />
      ) : null}
    </div>
  );
}

function CommentsSection({ info, level }: { info: Info; level: 'h2' | 'h3' }) {
  const { data: comments } = useComments(info.id);
  const list = comments ?? [];
  const H = level;
  const field = useRef<HTMLInputElement>(null);
  return (
    <section className="g-comments" aria-labelledby={`cm-${info.id}`}>
      <H id={`cm-${info.id}`}>
        {t.komentar.judul}{' '}
        <span className="n">{comments ? list.length : info.comments}</span>
      </H>
      {comments && !list.length ? (
        <p className="t-sm text-fg-2">{t.komentar.kosong}</p>
      ) : null}
      {list.map((c) => (
        <CommentItem key={c.id} infoId={info.id} comment={c} field={field} />
      ))}
      <CommentForm infoId={info.id} field={field} />
    </section>
  );
}

function CommentItem({
  infoId,
  comment,
  field,
}: {
  infoId: string;
  comment: CommentWithReactions;
  field: RefObject<HTMLInputElement | null>;
}) {
  const me = useSession();
  const now = useNow();
  const own = comment.creatorId === me.id;
  const mayDelete = own || can(me, 'moderateContent');
  const mine = myReaction(comment.reactions);
  const name = comment.creator.fullName;
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const react = useReact();
  const del = useDeleteComment(infoId);
  const close = useCallback((back: boolean) => {
    setPicking(false);
    if (back) trigger.current?.focus();
  }, []);
  useDismiss(picking, close, [picker, trigger]);
  return (
    <div className="g-comment" data-comment={comment.id}>
      <Avatar initials={initialsOf(name)} size="sm" />
      <div className="body">
        <p className="t-label">
          <b>{name}</b>{' '}
          <span className="t-cap text-fg-3">
            · {rel(comment.createdAt, now)}
          </span>
        </p>
        <p className="mt-0.5 t-sm [overflow-wrap:anywhere] whitespace-pre-line">
          {comment.content}
        </p>
        <div className="g-cmt-foot">
          <button
            ref={trigger}
            type="button"
            className="g-foot-btn sm"
            aria-expanded={picking}
            aria-label={commentReactLabel(mine, name)}
            onClick={() => setPicking((o) => !o)}
          >
            {mine ? (
              <PixelReaction reaction={mine} size={18} />
            ) : (
              <IconReaksi size={16} />
            )}
          </button>
          {reactionCounts(comment.reactions)
            .filter((r) => r.count > 0)
            .map((r) => (
              <span
                key={r.key}
                className="g-cmt-count"
                role="img"
                aria-label={fill(t.reaksi.jumlah, {
                  reaksi: reactionLabel(r.key),
                  jumlah: r.count,
                })}
              >
                <PixelReaction reaction={r.key} size={16} />
                <span aria-hidden="true">{r.count}</span>
              </span>
            ))}
          {mayDelete ? (
            <>
              <span className="flex-1" />
              <LinkButton onClick={() => setConfirm(true)}>
                {t.komentar.hapus}
              </LinkButton>
            </>
          ) : null}
        </div>
        {picking ? (
          <ReactionPicker
            pickerRef={picker}
            mine={mine}
            onPick={(k) => {
              react.mutate(
                {
                  target: { kind: 'comment', infoId, commentId: comment.id },
                  next: nextReaction(comment.reactions, k),
                },
                { onError: () => toast.error(t.reaksi.gagal) },
              );
              close(true);
            }}
          />
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t.hapus.komentarJudul}
        confirmLabel={t.hapus.ya}
        cancelLabel={t.hapus.batal}
        danger
        onConfirm={() =>
          del.mutate(comment.id, {
            onSuccess: () => {
              setConfirm(false);
              toast.success(t.komentar.dihapus);
              focusSoon(() => field.current);
            },
            onError: () => {
              setConfirm(false);
              toast.error(t.menu.gagal);
            },
          })
        }
      >
        {t.hapus.komentarText}
      </ConfirmDialog>
    </div>
  );
}

function CommentForm({
  infoId,
  field,
}: {
  infoId: string;
  field: RefObject<HTMLInputElement | null>;
}) {
  const me = useSession();
  const [text, setText] = useState('');
  const post = usePostComment(infoId);
  const send = (content: string) =>
    post.mutate(content, {
      onSuccess: () => {
        setText('');
        field.current?.focus();
        toast.success(t.komentar.terkirim);
      },
      onError: () =>
        toast.error(t.komentar.gagal, {
          action: {
            label: common.actions.cobaLagi,
            onClick: () => send(content),
          },
        }),
    });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || post.isPending) {
      field.current?.focus();
      return;
    }
    send(content);
  };
  return (
    <form className="g-composer" onSubmit={submit}>
      <Avatar initials={initialsOf(me.fullName)} size="sm" />
      <Input
        ref={field}
        name={COMMENT_FIELD}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.komentar.tulisPlaceholder}
        aria-label={t.komentar.tulis}
        autoComplete="off"
        data-comment-field=""
      />
      <Button type="submit" variant="gold" square aria-label={t.komentar.kirim}>
        <IconKirim size={16} />
      </Button>
    </form>
  );
}
