/**
 * A room in Welfare's inbox (P3-C, a proposal): `scrRoom` with the sides swapped. The member's messages
 * (`fromOwner`) sit on the surface on the left under the room's name; yours and your teammates' in gold on the
 * right, a teammate's as "Welfare". Balas, the reply chip, day lines and the composer are the member side's.
 *
 * No delivery states (SPEC's corrections): a reply is drawn once the server acknowledges it, and the send button is
 * busy meanwhile. If it fails (refused as invalid or server, no answer in 10 s, or the connection down) a toast says
 * so and the text stays; sending it again unchanged reuses its device id (`CurhatClient.retry`), so a reply saved
 * whose acknowledgement was lost is saved once (A11). `forbidden` and `unauthorized` give no toast: the connection
 * refetches the rooms and re-checks the session (`useCurhatConnection`). No delete: only the member may.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Chatroom } from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  toast,
} from '~/components/garis';
import {
  DeskHead,
  PageBody,
  PageTitle,
  TopBarActions,
  usePageTitle,
} from '~/components/shell/page';
import { curhat as c } from '~/copy/curhat';
import { fill } from '~/copy/fill';
import { kelolaCurhat as t } from '~/copy/kelola-curhat';
import { cn } from '~/lib/utils';
import { Composer } from '~/features/curhat/Composer';
import {
  markRoomRead,
  useCurhatClient,
  useCurhatState,
  useCurhatUnread,
  useRooms,
} from '~/features/curhat/data';
import { ConnectionBanner } from '~/features/curhat/List';
import { RoomSkeleton, useFollowNewest } from '~/features/curhat/Room';
import {
  buildThread,
  roomName,
  type ThreadMessage,
} from '~/features/curhat/rules';
import { PinMenu } from './PinMenu';
import {
  deliveredOnly,
  inboxSpeakerSr,
  inboxTimeLine,
  onWelfareSide,
  sendPlan,
  type FailedReply,
} from './rules';

const ROOM_ROUTE = '/_app/_left-navbar/kelola/curhat/$roomId' as const;

export function InboxRoomScreen() {
  const { roomId } = useParams({ from: ROOM_ROUTE });
  const rooms = useRooms();
  const room = rooms.data?.[roomId];

  if (room) return <Thread key={room.id} room={room} />;
  if (rooms.data) return <NotFound />;
  if (rooms.isError)
    return (
      <PageBody>
        <ErrorState
          title={c.daftar.gagal}
          onRetry={() => void rooms.refetch()}
          retrying={rooms.isFetching}
        />
      </PageBody>
    );
  return <RoomSkeleton />;
}

/** `scrRoom`'s not-found state: the member deleted the room. Its button goes back to the inbox. */
function NotFound() {
  const navigate = useNavigate();
  return (
    <PageBody>
      <PageTitle className="sr-only">{c.ruang.tidakDitemukan}</PageTitle>
      <EmptyState
        title={c.ruang.tidakDitemukan}
        text={c.ruang.tidakDitemukanIsi}
        action={
          <Button
            variant="paper"
            size="sm"
            className="mt-2.5"
            onClick={() => void navigate({ to: '/kelola/curhat' })}
          >
            {c.ruang.kembali}
          </Button>
        }
      />
    </PageBody>
  );
}

function Thread({ room }: { room: Chatroom }) {
  const qc = useQueryClient();
  const client = useCurhatClient();
  const { outbox } = useCurhatState();
  const rooms = useRooms();
  const unread = useCurhatUnread();
  const roomId = room.id;
  const name = roomName(room.title);
  usePageTitle(name);

  const delivered = useMemo(
    () => deliveredOnly(outbox.filter((e) => e.chatroomId === roomId)),
    [outbox, roomId],
  );
  const items = useMemo(
    () => buildThread(room.messages, delivered, Date.now()),
    [room.messages, delivered],
  );

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState<FailedReply | null>(null);
  const [failed, setFailed] = useState<FailedReply | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const focusField = () => requestAnimationFrame(() => field.current?.focus());

  // The open room: the member's messages here are read at once instead of counted.
  useEffect(() => {
    if (!client) return;
    client.openRoom = roomId;
    return () => {
      if (client.openRoom === roomId) client.openRoom = null;
    };
  }, [client, roomId]);

  // Opening it reads it: its count goes here, on the inbox, in Layanan and Kelola.
  const read = useRef(false);
  const unreadHere = unread.byRoom[roomId] ?? 0;
  const unreadKnown = unread.query.isSuccess;
  useEffect(() => {
    if (read.current || (unreadKnown && unreadHere === 0)) return;
    read.current = true;
    void markRoomRead(qc, roomId);
  }, [qc, roomId, unreadHere, unreadKnown]);

  const stick = useFollowNewest(items);

  // The reply's fate. Delivered entries leave the outbox as soon as the rooms cache holds them, so an entry that is
  // gone was delivered; a failed one stays (for the same device id next time).
  useEffect(() => {
    if (!sending) return;
    const entry = outbox.find((e) => e.localId === sending.localId);
    if (entry?.status === 'pending') return;
    setSending(null);
    if (!entry || entry.status === 'delivered') {
      setFailed(null);
      setReplyTo(null);
      setText((cur) => (cur.trim() === sending.text ? '' : cur));
      field.current?.focus();
      return;
    }
    setFailed(sending);
    if (entry.refusal !== 'forbidden' && entry.refusal !== 'unauthorized')
      toast.error(t.ruang.gagal);
  }, [outbox, sending]);

  const quoted =
    replyTo === null
      ? null
      : (items.find(
          (i): i is ThreadMessage => i.kind === 'message' && i.id === replyTo,
        )?.text ?? null);

  const send = () => {
    const body = text.trim();
    if (!body || !client) {
      field.current?.focus();
      return;
    }
    if (sending) return;
    const replyId = quoted === null ? null : replyTo;
    const plan = sendPlan(failed, body, replyId, outbox);
    stick.current = true;
    let localId: string;
    if (plan.kind === 'retry') {
      client.retry(plan.localId);
      localId = plan.localId;
    } else localId = client.send(roomId, body, replyId).localId;
    setSending({ localId, text: body, replyId });
  };

  return (
    <>
      <TopBarActions>
        <PinMenu room={room} size="md" />
      </TopBarActions>
      <DeskHead title={name} actions={<PinMenu room={room} size="md" />} />
      <PageBody className="g-room-page">
        <div
          className="g-chat"
          role="log"
          // Only what is added is read out, once.
          aria-relevant="additions"
          aria-label={fill(c.ruang.percakapan, { nama: name })}
        >
          {items.map((item) =>
            item.kind === 'day' ? (
              <p key={item.key} className="g-chat-day">
                {item.label}
              </p>
            ) : (
              <Message
                key={item.key}
                m={item}
                room={name}
                onReply={() => {
                  setReplyTo(item.id);
                  focusField();
                }}
              />
            ),
          )}
        </div>
        <Composer
          field={field}
          value={text}
          onChange={setText}
          onSend={send}
          busy={sending !== null}
          placeholder={t.ruang.tulis}
          label={fill(t.ruang.tulisLabel, { nama: name })}
          replyText={quoted}
          banner={<ConnectionBanner updatedAt={rooms.dataUpdatedAt} />}
          onCancelReply={() => {
            setReplyTo(null);
            focusField();
          }}
        />
      </PageBody>
    </>
  );
}

function Message({
  m,
  room,
  onReply,
}: {
  m: ThreadMessage;
  room: string;
  onReply: () => void;
}) {
  const welfare = onWelfareSide(m);
  return (
    <Fragment>
      <div className={cn('g-bubble', welfare ? 'me' : 'them')}>
        {m.quote !== null ? (
          <span className="quote">
            <span className="sr-only">{c.ruang.membalasSr}</span>
            {m.quote}
          </span>
        ) : null}
        <span className="sr-only">{inboxSpeakerSr(m, room)}</span>
        {m.text}
        <span className="tm">{inboxTimeLine(m, room)}</span>
      </div>
      <LinkButton
        className={cn('g-bubble-tools', !welfare && 'them')}
        onClick={onReply}
      >
        {c.ruang.balas}
      </LinkButton>
    </Fragment>
  );
}
