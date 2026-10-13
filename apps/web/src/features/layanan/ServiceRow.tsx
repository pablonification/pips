import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { RowButton, Tile } from '~/components/garis';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconLuar } from '~/components/icons/luar';
import { ICONS } from '~/components/icons/registry';
import { common } from '~/copy/common';
import type { Service } from '~/lib/services';

/** One service (garis/screens-more.js `svcRow`): icon tile, the members' name, its description, then a badge and a
 * chevron, or the external mark for a site outside PIPS! (a new tab). Layanan and the Kelola hub (P3-A) share it, so
 * their rows can't drift. */
export function ServiceRow({
  service: s,
  badge,
}: {
  service: Service;
  badge?: ReactNode;
}) {
  const Icon = ICONS[s.icon];
  const inner = (
    <span className="g-svc-row">
      <Tile>
        <Icon size={20} />
      </Tile>
      <span className="min-w-0 flex-1">
        <span className="block t-sub">{s.label}</span>
        <span className="block t-cap text-fg-2">{s.description}</span>
      </span>
      {badge}
      {s.kind === 'external' ? (
        <span className="g-chev text-fg-3">
          <IconLuar size={16} />
          <span className="sr-only"> {common.shell.situsLuar}</span>
        </span>
      ) : (
        <span className="g-chev text-fg-3">
          <IconLanjut size={18} />
        </span>
      )}
    </span>
  );
  return (
    <li>
      <RowButton asChild>
        {s.kind === 'external' ? (
          <a href={s.destination} target="_blank" rel="noopener">
            {inner}
          </a>
        ) : (
          <Link to={s.destination}>{inner}</Link>
        )}
      </RowButton>
    </li>
  );
}
