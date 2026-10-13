/**
 * A Curhat room (garis/screens-more.js `scrRoom`; app.js `renderPhone`, `reply`, `reply-cancel`, `del-room` and the
 * chat submit): the thread oldest first with day lines, your bubbles in gold and Welfare's on the surface, Balas,
 * the composer, and deleting the room after confirming. A focused flow on phones and tablets (no tab bar or rail).
 * What you send shows at once and settles into Terkirim or Gagal with Kirim ulang (SPEC story 96; OPEN-QUESTIONS D7).
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  Navigate,
  useNavigate,
  useParams,
  useRouter,
} from '@tanstack/react-router';
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LinkButton,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
  toast,
} from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconHapus } from '~/components/icons/hapus';
import { IconJam } from '~/components/icons/jam';
import { IconPeringatan } from '~/components/icons/peringatan';
import {
  DeskHead,
  PageBody,
  PageTitle,
  TopBarActions,
  usePageTitle,
} from '~/components/shell/page';
import { entryAt } from '~/components/shell/shell-state';
import { curhat as t } from '~/copy/curhat';
import { fill } from '~/copy/fill';
import useSession from '~/hooks/auth/useSession';
import { hm } from '~/lib/dates';
import { cn } from '~/lib/utils';
import { isWelfare } from './Area';
import { Composer } from './Composer';
import {
  markRoomRead,
  removeRoom,
  useCurhatClient,
  useCurhatState,
  useCurhatUnread,
  useDeleteRoom,
  useRooms,
} from './data';
import { atEnd, scroller, scrollToEnd, takeComposerFocus } from './focus';
import { ConnectionBanner } from './List';
import { buildThread, canReply, roomName, type ThreadMessage } from './rules';

const ROOM_ROUTE = '/_app/_left-navbar/layanan/curhat/$roomId' as const;

export function RoomScreen() {
  const me = useSession();
  if (isWelfare(me)) return <Navigate to="/layanan/curhat" replace />;
  return <MemberRoom />;
}

function MemberRoom() {
  const { roomId } = useParams({ from: ROOM_ROUTE });
  const rooms = useRooms();
  const [gone, setGone] = useState(false);
  const room = rooms.data?.[roomId];

  if (gone) return null;
  if (room)
    return (
      <Thread key={room.id} roomId={room.id} onGone={() => setGone(true)} />
    );
  if (rooms.data) return <NotFound />;
  if (rooms.isError)
    return (
      <PageBody>
        <ErrorState
          title={t.daftar.gagal}
          onRetry={() => void rooms.refetch()}
          retrying={rooms.isFetching}
        />
      </PageBody>
    );
  return <RoomSkeleton />;
}

function RoomSkeleton() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setLate(true), 300);
    return () => clearTimeout(id);
  }, []);
  if (!late) return null;
  return (
    <PageBody>
      <Skeleton label={t.daftar.memuat}>
        <div className="grid gap-3">
          <SkeletonBlock height={64} className="w-3/5 justify-self-end" />
          <SkeletonBlock height={84} className="w-3/4" />
          <SkeletonBar width="40%" />
        </div>
      </Skeleton>
    </PageBody>
  );
}

/** `scrRoom`'s not-found state: the room was deleted, or isn't yours. */
function NotFound() {
  const navigate = useNavigate();
  return (
    <PageBody>
      <PageTitle className="sr-only">{t.ruang.tidakDitemukan}</PageTitle>
      <EmptyState
        title={t.ruang.tidakDitemukan}
        text={t.ruang.tidakDitemukanIsi}
        action={
          <Button
            variant="paper"
            size="sm"
            className="mt-2.5"
            onClick={() => void navigate({ to: '/layanan/curhat' })}
          >
            {t.ruang.kembali}
          </Button>
        }
      />
    </PageBody>
  );
}

function Thread({ roomId, onGone }: { roomId: string; onGone: () => void }) {
  const qc = useQueryClient();
  const client = useCurhatClient();
  const { outbox } = useCurhatState();
  const rooms = useRooms();
  const unread = useCurhatUnread();
  const room = rooms.data![roomId];
  const name = roomName(room.title);
  usePageTitle(name);

  const mine = useMemo(
    () => outbox.filter((e) => e.chatroomId === roomId),
    [outbox, roomId],
  );
  const items = useMemo(
    () => buildThread(room.messages, mine, Date.now()),
    [room.messages, mine],
  );

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const focusField = () => requestAnimationFrame(() => field.current?.focus());

  // The open room: Welfare's replies here are read at once instead of counted.
  useEffect(() => {
    if (!client) return;
    client.openRoom = roomId;
    return () => {
      if (client.openRoom === roomId) client.openRoom = null;
    };
  }, [client, roomId]);

  // Opening it reads it (story 97): its count goes here, on the list, on Beranda and in Layanan.
  const read = useRef(false);
  const unreadHere = unread.byRoom[roomId] ?? 0;
  const unreadKnown = unread.query.isSuccess;
  useEffect(() => {
    if (read.current || (unreadKnown && unreadHere === 0)) return;
    read.current = true;
    void markRoomRead(qc, roomId);
  }, [qc, roomId, unreadHere, unreadKnown]);

  // Opening a room shows its newest message; a new room from Mulai ruang baru focuses the composer.
  useLayoutEffect(() => {
    scrollToEnd();
    const id = requestAnimationFrame(scrollToEnd);
    if (takeComposerFocus()) field.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(id);
  }, []);

  // Sending, or receiving while at the newest message, keeps you there.
  const nearEnd = useRef(true);
  const stick = useRef(false);
  useEffect(() => {
    const el = scroller();
    if (!el) return;
    const onScroll = () => (nearEnd.current = atEnd(el));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  // The bar grows (the reply chip, a longer draft) over the end of the thread: at the end, stay there, so it never
  // covers the newest message or its Balas and Kirim ulang.
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.g-chat-bar');
    if (!bar || typeof ResizeObserver === 'undefined') return;
    let last = bar.offsetHeight;
    const ro = new ResizeObserver(() => {
      const h = bar.offsetHeight;
      if (h > last && nearEnd.current) scrollToEnd();
      last = h;
    });
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);
  // On every change of the thread, not just its length: a delivered message grows (Terkirim, then Balas).
  useLayoutEffect(() => {
    if (stick.current || nearEnd.current) scrollToEnd();
    stick.current = false;
  }, [items]);

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
    stick.current = true;
    client.send(roomId, body, quoted === null ? null : replyTo);
    setText('');
    setReplyTo(null);
    field.current?.focus();
  };

  const [confirm, setConfirm] = useState(false);
  const del = useDeleteRoom();
  const router = useRouter();
  const navigate = useNavigate();
  const remove = () => {
    if (del.isPending) return;
    del.mutate(roomId, {
      onSuccess: () => {
        setConfirm(false);
        onGone();
        removeRoom(qc, roomId);
        client?.dropRoom(roomId);
        toast.success(t.hapus.dihapus);
        // Back can't return to it: the list replaces it, or history goes back to the list it came from.
        const index =
          (router.state.location.state as { __TSR_index?: number })
            .__TSR_index ?? 0;
        if (index > 0 && entryAt(index - 1)?.pathname === '/layanan/curhat')
          router.history.back();
        else void navigate({ to: '/layanan/curhat', replace: true });
      },
      onError: () => {
        setConfirm(false);
        toast.error(t.hapus.gagal);
      },
    });
  };

  return (
    <>
      <TopBarActions>
        <IconButton label={t.ruang.hapusIni} onClick={() => setConfirm(true)}>
          <IconHapus />
        </IconButton>
      </TopBarActions>
      <DeskHead
        title={name}
        actions={
          <Button variant="danger-ghost" onClick={() => setConfirm(true)}>
            <IconHapus size={20} />
            {t.ruang.hapus}
          </Button>
        }
      />
      <PageBody className="g-room-page">
        {items.length ? null : (
          <p className="g-chat-first t-sm text-fg-2">{t.ruang.pertama}</p>
        )}
        <div
          className="g-chat"
          role="log"
          // Only what is added is read out (a new message, its Gagal line), once; not every change of a time line
          // (review minor 5). The Gagal line is the one announcement of a failure.
          aria-relevant="additions"
          aria-label={fill(t.ruang.percakapan, { nama: name })}
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
                onReply={() => {
                  setReplyTo(item.id);
                  focusField();
                }}
                onRetry={() => {
                  if (item.localId) client?.retry(item.localId);
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
          replyText={quoted}
          // In the bar at the bottom, so it is in view at the newest message, where the room opens (review M1).
          banner={<ConnectionBanner updatedAt={rooms.dataUpdatedAt} />}
          onCancelReply={() => {
            setReplyTo(null);
            focusField();
          }}
        />
      </PageBody>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t.hapus.judul}
        confirmLabel={t.hapus.ya}
        cancelLabel={t.hapus.batal}
        danger
        onConfirm={remove}
      >
        {t.hapus.isi}
      </ConfirmDialog>
    </>
  );
}

function TimeLine({ m }: { m: ThreadMessage }) {
  if (!m.mine)
    return (
      <span className="tm">
        {fill(t.ruang.waktuWelfare, { jam: hm(m.at) })}
      </span>
    );
  if (m.delivery === 'pending')
    return (
      <span className="tm">
        <IconJam size={16} />
        {t.ruang.mengirim}
      </span>
    );
  if (m.newestDelivered)
    return (
      <span className="tm">
        <IconCentang size={16} />
        {fill(t.ruang.waktuTerkirim, { jam: hm(m.at) })}
      </span>
    );
  return <span className="tm">{hm(m.at)}</span>;
}

function Message({
  m,
  onReply,
  onRetry,
}: {
  m: ThreadMessage;
  onReply: () => void;
  onRetry: () => void;
}) {
  return (
    <Fragment>
      <div className={cn('g-bubble', m.mine ? 'me' : 'them')}>
        {m.quote !== null ? (
          <span className="quote">
            <span className="sr-only">{t.ruang.membalasSr}</span>
            {m.quote}
          </span>
        ) : null}
        <span className="sr-only">
          {m.mine ? t.ruang.kamuSr : t.ruang.welfareSr}
        </span>
        {m.text}
        <TimeLine m={m} />
      </div>
      {canReply(m) ? (
        <LinkButton
          className={cn('g-bubble-tools', !m.mine && 'them')}
          onClick={onReply}
        >
          {t.ruang.balas}
        </LinkButton>
      ) : m.delivery === 'failed' ? (
        <div className="g-bubble-fail">
          <span className="g-err">
            <IconPeringatan size={16} />
            {t.ruang.gagal}
          </span>
          <LinkButton onClick={onRetry}>{t.ruang.kirimUlang}</LinkButton>
        </div>
      ) : null}
    </Fragment>
  );
}
