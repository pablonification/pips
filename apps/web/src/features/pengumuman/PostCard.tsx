/**
 * A post in the list: the card on phones and tablets (`postItem`) and the row beside the post on desktop
 * (`postCompact`). The title links to the post; on a card the stretched link makes the whole card open it while the
 * controls inside stay on top.
 */
import { Link } from '@tanstack/react-router';
import { useCallback, useRef, useState } from 'react';
import type { Info } from '~/api/generated';
import { Avatar, RowButton, Tag, UnreadBar, toast } from '~/components/garis';
import type { PixelReactionKey } from '~/components/garis/pixel-art';
import { IconBagikan } from '~/components/icons/bagikan';
import { IconKomentar } from '~/components/icons/komentar';
import { fill } from '~/copy/fill';
import { pengumuman as t } from '~/copy/pengumuman';
import useSession from '~/hooks/auth/useSession';
import { rel } from '~/lib/dates';
import { initialsOf } from '~/lib/shell/names';
import { cn } from '~/lib/utils';
import { useReact } from './data';
import {
  LinkCards,
  Photos,
  ReactionPicker,
  ReactSummaryButton,
  Sr,
  sharePost,
  useDismiss,
} from './parts';
import { PostMenu } from './PostMenu';
import {
  audText,
  displayText,
  isForEveryone,
  myReaction,
  nextReaction,
} from './rules';
import { useNow } from './useNow';
import { rememberCard, wantComment, type FeedSearch } from './view';

export function Byline({ info, now }: { info: Info; now: number }) {
  const me = useSession();
  return (
    <div className="min-w-0 flex-1">
      <p className="who">
        {info.creator.fullName}
        {info.creatorId === me.id ? (
          <Tag className="ml-1">{t.feed.kamu}</Tag>
        ) : null}
      </p>
      <p className="meta">
        <span>{rel(info.createdAt, now)}</span>
        {isForEveryone(info) ? null : ` · ${audText(info)}`}
      </p>
    </div>
  );
}

/** React from a card or a post: optimistic, rolled back with an error toast; focus back to the picker's trigger. */
export function useReactTo(info: Info) {
  const react = useReact();
  return useCallback(
    (key: PixelReactionKey) =>
      react.mutate(
        {
          target: { kind: 'info', infoId: info.id },
          next: nextReaction(info.reactions, key),
        },
        { onError: () => toast.error(t.reaksi.gagal) },
      ),
    [react, info],
  );
}

export function PostCard({ info, search }: { info: Info; search: FeedSearch }) {
  const now = useNow();
  const unread = !info.isRead;
  const tid = `post-${info.id}`;
  const [picking, setPicking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const reactTo = useReactTo(info);
  const close = useCallback((back: boolean) => {
    setPicking(false);
    if (back) trigger.current?.focus();
  }, []);
  useDismiss(picking, close, [picker, trigger]);

  const link = (text: string) => (
    <Link
      to="/pengumuman/$id"
      params={{ id: info.id }}
      search={search}
      className="g-post-link"
      data-post-link={info.id}
      onClick={() => rememberCard(info.id)}
    >
      {text}
      {unread ? <Sr>{t.feed.belumDibacaSr}</Sr> : null}
    </Link>
  );

  return (
    <li>
      <article
        className={cn('g-post', unread && 'unread')}
        aria-labelledby={tid}
      >
        <div className="g-post-head">
          <Avatar initials={initialsOf(info.creator.fullName)} />
          <Byline info={info} now={now} />
          <div className="z">
            <PostMenu info={info} />
          </div>
        </div>
        {info.title ? (
          <>
            <h2 className="g-post-title" id={tid}>
              {link(info.title)}
            </h2>
            <p className="g-post-text line-clamp-3 whitespace-pre-line">
              {displayText(info.content)}
            </p>
          </>
        ) : (
          <p
            className="g-post-text lead line-clamp-3 whitespace-pre-line"
            id={tid}
          >
            {link(displayText(info.content))}
          </p>
        )}
        <Photos medias={info.infoMedias ?? []} />
        <LinkCards info={info} />
        {info.infoCategories?.length ? (
          <div className="g-post-tags">
            {info.infoCategories.map((c) => (
              <Tag key={c.categoryId}>{c.category.name}</Tag>
            ))}
          </div>
        ) : null}
        <div className="g-post-foot">
          <ReactSummaryButton
            reactions={info.reactions}
            open={picking}
            onClick={() => setPicking((o) => !o)}
            buttonRef={trigger}
          />
          <Link
            to="/pengumuman/$id"
            params={{ id: info.id }}
            search={search}
            className="g-foot-btn"
            aria-label={fill(t.feed.komentar, { jumlah: info.comments })}
            onClick={() => {
              rememberCard(info.id);
              wantComment(info.id);
            }}
          >
            <IconKomentar size={20} />
            <span aria-hidden="true">{info.comments || ''}</span>
          </Link>
          <span className="flex-1" />
          <button
            type="button"
            className="g-foot-btn"
            aria-label={t.feed.bagikan}
            onClick={() => void sharePost(info)}
          >
            <IconBagikan size={20} />
          </button>
        </div>
        {picking ? (
          <div className="z">
            <ReactionPicker
              pickerRef={picker}
              mine={myReaction(info.reactions)}
              onPick={(k) => {
                reactTo(k);
                close(true);
              }}
            />
          </div>
        ) : null}
      </article>
    </li>
  );
}

/** A desktop row beside the post: category, author and time, the title (or the text), the excerpt. */
export function PostRow({
  info,
  selected,
  search,
  onOpen,
}: {
  info: Info;
  selected: boolean;
  search: FeedSearch;
  onOpen: (id: string) => void;
}) {
  const now = useNow();
  const unread = !info.isRead;
  return (
    <li>
      <RowButton asChild current={selected}>
        <Link
          to="/pengumuman/$id"
          params={{ id: info.id }}
          search={search}
          // Current only on its own post (the row's highlight follows aria-current="page").
          activeOptions={{ exact: true }}
          data-post-row={info.id}
          onClick={() => onOpen(info.id)}
        >
          <span className="g-item">
            <UnreadBar unread={unread} />
            <span className="min-w-0 flex-1">
              <span className="g-row-meta">
                {info.infoCategories?.map((c) => (
                  <Tag key={c.categoryId}>{c.category.name}</Tag>
                ))}
                <span>
                  {info.creator.fullName} · {rel(info.createdAt, now)}
                </span>
              </span>
              <span
                className={cn('g-row-title line-clamp-2', !unread && 'read')}
              >
                {info.title || displayText(info.content)}
                {unread ? <Sr>{t.feed.belumDibacaSr}</Sr> : null}
              </span>
              {info.title ? (
                <span className="g-row-text line-clamp-2">
                  {displayText(info.content)}
                </span>
              ) : null}
            </span>
          </span>
        </Link>
      </RowButton>
    </li>
  );
}
