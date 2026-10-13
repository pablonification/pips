/**
 * Layanan › Curhat Yuk! (garis/screens-more.js `scrCurhat`): the privacy note, your rooms on a ruled list (newest
 * message first), "{n} dari 3 ruang dipakai" and Mulai ruang baru. A pengurus without rooms sees the same screen,
 * empty (`*-pengurus-curhat-empty`).
 */
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ApiError, type Chatroom } from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  NoteBox,
  OfflineBanner,
  RowButton,
  RuledList,
  Skeleton,
  SkeletonRow,
  toast,
} from '~/components/garis';
import { IconKunci } from '~/components/icons/kunci';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconTambah } from '~/components/icons/tambah';
import { keepFocusOnNavigationTo } from '~/components/shell/focus';
import { DeskHead, PageBody } from '~/components/shell/page';
import { curhat as t } from '~/copy/curhat';
import { fill } from '~/copy/fill';
import { hm } from '~/lib/dates';
import { serviceById } from '~/lib/services';
import {
  addRoom,
  useCreateRoom,
  useCurhatClient,
  useCurhatState,
  useCurhatUnread,
  useRooms,
} from './data';
import {
  isFull,
  listTime,
  previewOf,
  roomInitials,
  roomName,
  roomsUsed,
  sortRooms,
  unreadSr,
} from './rules';
import { wantComposerFocus } from './focus';

/** Loading placeholders appear only after this long, so a quick answer doesn't flash them (SPEC "Patterns"). */
const SKELETON_DELAY_MS = 300;

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the device says it is online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function useDelayed(active: boolean, ms = SKELETON_DELAY_MS) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) return setLate(false);
    const id = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(id);
  }, [active, ms]);
  return active && late;
}

/**
 * Above the data already loaded: the device is offline (P0-A's banner, with the last update), or only Curhat's
 * connection is down ("Koneksi Curhat terputus. Menyambungkan lagi…", OPEN-QUESTIONS D7).
 */
export function ConnectionBanner({ updatedAt }: { updatedAt: number }) {
  const online = useOnline();
  const { status } = useCurhatState();
  if (!online) return <OfflineBanner updatedAt={hm(updatedAt || Date.now())} />;
  if (status !== 'down') return null;
  return (
    <div className="g-offline" role="status">
      <IconPeringatan size={16} />
      <span>{t.ruang.terputus}</span>
    </div>
  );
}

function RoomRow({ room, unread }: { room: Chatroom; unread: number }) {
  const name = roomName(room.title);
  const when = listTime(room, Date.now());
  return (
    <li>
      <RowButton asChild>
        <Link to="/layanan/curhat/$roomId" params={{ roomId: room.id }}>
          <span className="g-svc-row">
            <span className="g-room-av" aria-hidden="true">
              {roomInitials(name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block t-sub">
                {name}
                {unread ? (
                  <span className="sr-only">{unreadSr(unread)}</span>
                ) : null}
              </span>
              <span className="line-clamp-1 t-cap text-fg-2">
                {previewOf(room)}
              </span>
            </span>
            <span className="g-room-end">
              <span className="t-cap text-fg-3 num">{when}</span>
              {unread ? (
                <span className="g-count" aria-hidden="true">
                  {unread}
                </span>
              ) : null}
            </span>
          </span>
        </Link>
      </RowButton>
    </li>
  );
}

function NewRoom({ count }: { count: number }) {
  const qc = useQueryClient();
  const client = useCurhatClient();
  const navigate = useNavigate();
  const create = useCreateRoom();
  const full = isFull(count);
  const busy = create.isPending;
  const start = () => {
    // Full: the button stays focusable and says why with a toast, without asking the server (app.js `new-room`).
    if (full) {
      toast.error(t.daftar.penuhToast);
      return;
    }
    if (busy) return;
    create.mutate(undefined, {
      onSuccess: (room) => {
        addRoom(qc, room);
        void client?.join(room.id);
        toast.success(fill(t.daftar.dibuat, { nama: roomName(room.title) }));
        const path = `/layanan/curhat/${encodeURIComponent(room.id)}`;
        // The new room opens with the composer focused, as the prototype does.
        keepFocusOnNavigationTo(path);
        wantComposerFocus();
        void navigate({
          to: '/layanan/curhat/$roomId',
          params: { roomId: room.id },
        });
      },
      onError: (e) => {
        if (e instanceof ApiError && e.status === 400)
          toast.error(t.daftar.penuhToast);
        else toast.error(t.daftar.gagalBuat);
      },
    });
  };
  return (
    <>
      <div className="g-room-foot">
        <span className="t-cap text-fg-3">{roomsUsed(count)}</span>
        <Button
          variant="gold"
          size="sm"
          aria-disabled={full || busy || undefined}
          aria-busy={busy || undefined}
          onClick={start}
        >
          <IconTambah size={16} />
          {t.daftar.mulai}
        </Button>
      </div>
      {full ? <p className="t-cap text-fg-3">{t.daftar.penuh}</p> : null}
    </>
  );
}

export function CurhatList() {
  const rooms = useRooms();
  const { byRoom } = useCurhatUnread();
  const late = useDelayed(rooms.isPending && rooms.fetchStatus !== 'paused');
  const list = rooms.data ? sortRooms(Object.values(rooms.data)) : null;

  let inner;
  if (list) {
    inner = (
      <>
        {list.length ? (
          <RuledList>
            {list.map((r) => (
              <RoomRow key={r.id} room={r} unread={byRoom[r.id] ?? 0} />
            ))}
          </RuledList>
        ) : (
          <EmptyState title={t.daftar.kosongJudul} text={t.daftar.kosongIsi} />
        )}
        <NewRoom count={list.length} />
      </>
    );
  } else if (rooms.isError) {
    inner = (
      <ErrorState
        title={t.daftar.gagal}
        onRetry={() => void rooms.refetch()}
        retrying={rooms.isFetching}
      />
    );
  } else if (late) {
    inner = (
      <Skeleton label={t.daftar.memuat}>
        <SkeletonRow lines={['40%', '80%']} />
        <SkeletonRow lines={['36%', '72%']} />
      </Skeleton>
    );
  } else inner = null;

  return (
    <>
      <DeskHead title={serviceById('curhat').label} />
      <PageBody className="g-curhat-page">
        {rooms.data ? (
          <ConnectionBanner updatedAt={rooms.dataUpdatedAt} />
        ) : null}
        <NoteBox icon={<IconKunci size={20} />}>
          <p>
            <b className="font-semibold text-fg">{t.daftar.anonim}</b>{' '}
            {t.daftar.anonimIsi}
          </p>
        </NoteBox>
        {inner}
      </PageBody>
    </>
  );
}
