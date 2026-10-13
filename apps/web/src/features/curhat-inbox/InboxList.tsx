/**
 * Kelola › Curhat Yuk! (P3-C, a proposal: the prototype has no inbox, OPEN-QUESTIONS D9). Every member's room, built
 * from `scrCurhat`'s rows: the search over names and messages and the Belum dibaca chip (both in the URL, changed
 * with `replace`), pinned rooms under "Disematkan" then the rest under "Ruang lain", each row a link to its room with
 * its options button. No privacy note and no start-a-room button: those are the member's. Only the room's anonymous
 * name ever shows.
 */
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Chatroom } from '~/api/generated';
import {
  Chip,
  Chips,
  EmptyState,
  ErrorState,
  RowButton,
  RuledList,
  Searchbox,
  SectionHead,
  Skeleton,
  SkeletonRow,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { curhat as c } from '~/copy/curhat';
import { kelolaCurhat as t } from '~/copy/kelola-curhat';
import { serviceById } from '~/lib/services';
import { useCurhatUnread, useRooms } from '~/features/curhat/data';
import { ConnectionBanner, useDelayed } from '~/features/curhat/List';
import {
  listTime,
  roomInitials,
  roomName,
  unreadSr,
} from '~/features/curhat/rules';
import { PinMenu } from './PinMenu';
import { inboxPreview, inboxView, type InboxFilter } from './rules';

function InboxRow({ room, unread }: { room: Chatroom; unread: number }) {
  const name = roomName(room.title);
  return (
    <li className="g-inbox-row">
      <RowButton asChild>
        <Link to="/kelola/curhat/$roomId" params={{ roomId: room.id }}>
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
                {inboxPreview(room)}
              </span>
            </span>
            <span className="g-room-end">
              <span className="t-cap text-fg-3 num">
                {listTime(room, Date.now())}
              </span>
              {unread ? (
                <span className="g-count" aria-hidden="true">
                  {unread}
                </span>
              ) : null}
            </span>
          </span>
        </Link>
      </RowButton>
      <PinMenu room={room} />
    </li>
  );
}

function Rooms({
  rooms,
  byRoom,
}: {
  rooms: Chatroom[];
  byRoom: Record<string, number>;
}) {
  return (
    <RuledList>
      {rooms.map((r) => (
        <InboxRow key={r.id} room={r} unread={byRoom[r.id] ?? 0} />
      ))}
    </RuledList>
  );
}

/** The search and the toggle, from the URL; changes replace the entry, so Back leaves the inbox. */
function Tools({ view }: { view: InboxFilter }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(view.q ?? '');
  // The URL changed elsewhere (Back to a link with another search): the field follows.
  useEffect(() => {
    setQ((cur) => (cur === (view.q ?? '') ? cur : (view.q ?? '')));
  }, [view.q]);
  const setView = (next: InboxFilter) =>
    void navigate({
      to: '/kelola/curhat',
      search: (prev) => ({ ...prev, ...next }),
      replace: true,
    });
  return (
    <>
      <Searchbox
        label={t.daftar.cariLabel}
        placeholder={t.daftar.cari}
        value={q}
        onChange={(e) => {
          const value = e.target.value;
          setQ(value);
          setView({ q: value ? value : undefined });
        }}
      />
      <Chips label={t.daftar.saring}>
        <Chip
          selected={!!view.unread}
          onSelectedChange={(on) => setView({ unread: on || undefined })}
        >
          {t.daftar.belumDibaca}
        </Chip>
      </Chips>
    </>
  );
}

export function InboxList({ view }: { view: InboxFilter }) {
  const rooms = useRooms();
  const { byRoom } = useCurhatUnread();
  const late = useDelayed(rooms.isPending && rooms.fetchStatus !== 'paused');

  let inner;
  if (rooms.data) {
    const { pinned, rest, empty } = inboxView(
      Object.values(rooms.data),
      view,
      byRoom,
    );
    inner =
      empty === 'none' ? (
        <EmptyState title={t.daftar.kosongJudul} text={t.daftar.kosongIsi} />
      ) : empty === 'noMatch' ? (
        <EmptyState title={t.daftar.tidakCocok} text={t.daftar.tidakCocokIsi} />
      ) : empty === 'allRead' ? (
        <EmptyState title={t.daftar.semuaDibaca} />
      ) : pinned.length ? (
        <>
          <section className="grid gap-1">
            <SectionHead title={t.daftar.disematkan} />
            <Rooms rooms={pinned} byRoom={byRoom} />
          </section>
          {rest.length ? (
            <section className="grid gap-1">
              <SectionHead title={t.daftar.ruangLain} />
              <Rooms rooms={rest} byRoom={byRoom} />
            </section>
          ) : null}
        </>
      ) : (
        <Rooms rooms={rest} byRoom={byRoom} />
      );
  } else if (rooms.isError) {
    inner = (
      <ErrorState
        title={c.daftar.gagal}
        onRetry={() => void rooms.refetch()}
        retrying={rooms.isFetching}
      />
    );
  } else if (late) {
    inner = (
      <Skeleton label={c.daftar.memuat}>
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
        <Tools view={view} />
        {inner}
      </PageBody>
    </>
  );
}
