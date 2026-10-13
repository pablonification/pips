/**
 * What global search searches (the prototype's `palIndex` in garis/app.js). Each source is a hook that returns its
 * items in the order they should appear; `usePaletteItems` joins them, and P0-C's `paletteResults` ranks and groups
 * them (src/lib/shell/palette.ts). Sources, in order:
 * - Tindakan: Buat pengumuman and Tambah mata kuliah to start; Nyalakan notifikasi while it's off on this device, and
 *   the switch to the other theme, only when the query finds them (P1-A);
 * - Layanan: the service registry, the pinned ones as "Pintasan" to start (P0-C);
 * - Pengumuman: `GET /info?search=` from 3 characters (P1-A);
 * - Kalender: your events in the next 21 days (P1-A);
 * - Mata kuliah: this semester's courses, opening their Ding Dong folder (P1-A);
 * - Orang: `GET /user/nim?search=` from 3 characters, opening NIM Finder with the name (P1-A).
 * The two API sources wait for typing to pause, join when they answer, and are left out if they fail.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { api } from '~/api/client';
import { INFO_LIST_QUERY_KEY } from '~/api/constants';
import { openPushPrompt, usePushState } from '~/components/push';
import { cari } from '~/copy/cari';
import { common } from '~/copy/common';
import {
  asksApi,
  remotePending,
  eventHint,
  personHint,
  postLabel,
  REMOTE_DEBOUNCE_MS,
  upcomingEvents,
  UPCOMING_DAYS,
} from '~/features/cari/rules';
import { useCourses, useMonthsEvents, useNow } from '~/features/kalender/data';
import { useOpenEvent } from '~/features/kalender/open';
import { evLabel } from '~/features/kalender/rules';
import useSession from '~/hooks/auth/useSession';
import { rel } from '~/lib/dates';
import { dayKeyOf, daysFrom, monthsOf } from '~/lib/days';
import type { PaletteItem } from '~/lib/shell/palette';
import { PINNED_SERVICES, visibleServices, type Service } from '~/lib/services';
import { useTheme } from '~/lib/theme/useTheme';

/** Opens a service: its page, or an external site in a new tab (PIPS! stays open). */
export function openService(
  service: Service,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (service.kind === 'external')
    window.open(service.destination, '_blank', 'noopener,noreferrer');
  else void navigate({ to: service.destination });
}

function useServiceItems(): PaletteItem[] {
  const user = useSession();
  const navigate = useNavigate();
  return useMemo(
    () =>
      visibleServices(user).map((s) => ({
        id: `layanan:${s.id}`,
        group: common.palette.layanan,
        label: s.label,
        icon: s.icon,
        hint: s.kind === 'external' ? common.palette.situsLuar : s.description,
        keywords: `${s.synonyms.join(' ')} ${s.description}`.toLowerCase(),
        pinned: (PINNED_SERVICES as readonly string[]).includes(s.id),
        run: () => openService(s, navigate),
      })),
    [user, navigate],
  );
}

/* ================= P1-A's sources ================= */

function useActionItems(): PaletteItem[] {
  const navigate = useNavigate();
  const push = usePushState();
  const { theme, setPreference } = useTheme();
  const pushOff =
    push.status === 'belum' ||
    push.status === 'diblokir' ||
    push.status === 'perlu-pasang';
  return useMemo(() => {
    const dark = theme === 'dark';
    const items: PaletteItem[] = [
      {
        id: 'tindakan:buat-pengumuman',
        group: common.palette.tindakan,
        label: cari.buatPengumuman.label,
        icon: 'pengumuman',
        hint: cari.buatPengumuman.hint,
        keywords: cari.buatPengumuman.kata,
        start: true,
        run: () => void navigate({ to: '/pengumuman/tulis' }),
      },
      {
        id: 'tindakan:tambah-matkul',
        group: common.palette.tindakan,
        label: cari.tambahMatkul.label,
        icon: 'matkul',
        hint: cari.tambahMatkul.hint,
        keywords: cari.tambahMatkul.kata,
        start: true,
        run: () => void navigate({ to: '/profil/matkul/tambah' }),
      },
    ];
    if (pushOff)
      items.push({
        id: 'tindakan:notifikasi',
        group: common.palette.tindakan,
        label: cari.nyalakanNotifikasi.label,
        icon: 'lonceng',
        hint: cari.nyalakanNotifikasi.hint,
        keywords: cari.nyalakanNotifikasi.kata,
        run: () => void openPushPrompt(),
      });
    items.push({
      id: 'tindakan:tema',
      group: common.palette.tindakan,
      label: dark ? common.palette.keTerang : common.palette.keGelap,
      icon: dark ? 'terang' : 'gelap',
      hint: common.palette.tampilan,
      keywords: cari.tema.kata,
      run: () => setPreference(dark ? 'light' : 'dark'),
    });
    return items;
  }, [navigate, pushOff, theme, setPreference]);
}

/** The query once typing has paused. */
function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

function usePostItems(query: string): {
  items: PaletteItem[];
  fetching: boolean;
} {
  const navigate = useNavigate();
  const q = query.trim();
  const found = useQuery({
    queryKey: [INFO_LIST_QUERY_KEY, 'search', q],
    queryFn: () => api.info.getListInfo({ search: q }).then((r) => r.infos),
    enabled: asksApi(q),
    retry: false,
  });
  const items = useMemo(
    () =>
      asksApi(q) && found.data
        ? found.data.map((p) => ({
            id: `pengumuman:${p.id}`,
            group: cari.grup.pengumuman,
            label: postLabel(p),
            icon: 'pengumuman' as const,
            hint: rel(p.createdAt),
            // The API found it by its text or author: the row must pass the palette's own match too.
            keywords: `${q} ${p.content} ${p.creator.fullName}`.toLowerCase(),
            run: () =>
              void navigate({ to: '/pengumuman/$id', params: { id: p.id } }),
          }))
        : [],
    [found.data, navigate, q],
  );
  return { items, fetching: found.isFetching };
}

function useEventItems(): PaletteItem[] {
  const now = useNow();
  const open = useOpenEvent();
  const courses = useCourses();
  const months = useMemo(
    () => monthsOf(daysFrom(dayKeyOf(now), UPCOMING_DAYS + 1)),
    [now],
  );
  const { events } = useMonthsEvents(months);
  return useMemo(
    () =>
      upcomingEvents(events, now).map((e) => {
        const course = e.courseId ? courses.byId.get(e.courseId) : undefined;
        return {
          id: `kalender:${e.id}`,
          group: cari.grup.kalender,
          label: evLabel(e, course),
          icon: 'kalender' as const,
          hint: eventHint(e),
          keywords: `${course?.name ?? ''} ${e.description}`.toLowerCase(),
          run: () => open(e),
        };
      }),
    [events, now, courses.byId, open],
  );
}

function useCourseItems(): PaletteItem[] {
  const navigate = useNavigate();
  const { data } = useCourses();
  return useMemo(
    () =>
      (data ?? []).flatMap((uc) => {
        const c = uc.course;
        if (!c) return [];
        return [
          {
            id: `matkul:${c.id}`,
            group: cari.grup.mataKuliah,
            label: `${c.code} ${c.name}`,
            icon: 'folder' as const,
            hint: cari.dingDong,
            keywords: cari.kataMatkul,
            run: () => {
              if (c.dingdongUrl)
                window.open(c.dingdongUrl, '_blank', 'noopener,noreferrer');
              else void navigate({ to: '/layanan/dingdong' });
            },
          },
        ];
      }),
    [data, navigate],
  );
}

function usePeopleItems(query: string): {
  items: PaletteItem[];
  fetching: boolean;
} {
  const navigate = useNavigate();
  const q = query.trim();
  const found = useQuery({
    queryKey: ['nim-finder', 'search', q],
    queryFn: () => api.userFinder.getUser({ search: q }),
    enabled: asksApi(q),
    retry: false,
  });
  const items = useMemo(
    () =>
      asksApi(q) && found.data
        ? found.data.map((p) => ({
            id: `orang:${p.nim}`,
            group: cari.grup.orang,
            label: p.fullName,
            icon: 'profil' as const,
            hint: personHint(p),
            keywords: p.nim,
            run: () =>
              void navigate({ to: '/layanan/nim', search: { q: p.fullName } }),
          }))
        : [],
    [found.data, navigate, q],
  );
  return { items, fetching: found.isFetching };
}

/**
 * Every source's items for `query`, in the prototype's order, and whether the API's are still on their way (so an
 * empty list isn't yet "no results").
 */
export function usePaletteItems(query = ''): {
  items: PaletteItem[];
  pending: boolean;
} {
  const remote = useDebounced(query, REMOTE_DEBOUNCE_MS);
  const actions = useActionItems();
  const services = useServiceItems();
  const posts = usePostItems(remote);
  const events = useEventItems();
  const courses = useCourseItems();
  const people = usePeopleItems(remote);
  const items = useMemo(
    () => [
      ...actions,
      ...services,
      ...posts.items,
      ...events,
      ...courses,
      ...people.items,
    ],
    [actions, services, posts.items, events, courses, people.items],
  );
  return {
    items,
    pending: remotePending(query, remote, [posts.fetching, people.fetching]),
  };
}
