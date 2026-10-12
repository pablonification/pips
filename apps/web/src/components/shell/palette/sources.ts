/**
 * What global search searches. Each source is a hook that returns its items in the order they should appear;
 * the palette joins them in `usePaletteItems`. P0-C searches the service registry (with the pinned services as
 * "Pintasan"); P1-A adds Tindakan, Pengumuman, Kalender, Mata kuliah and Orang as sources here (its brief, item 8).
 */
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { common } from '~/copy/common';
import useSession from '~/hooks/auth/useSession';
import type { PaletteItem } from '~/lib/shell/palette';
import { PINNED_SERVICES, visibleServices, type Service } from '~/lib/services';

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

export function usePaletteItems(): PaletteItem[] {
  const services = useServiceItems();
  return services;
}
