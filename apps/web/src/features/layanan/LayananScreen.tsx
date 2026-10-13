import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { formListQuery } from '~/api/queries';
import {
  Count,
  RowButton,
  RuledList,
  SectionHead,
  Tag,
  Tile,
} from '~/components/garis';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconLuar } from '~/components/icons/luar';
import { ICONS } from '~/components/icons/registry';
import { DeskHead, PageBody, PageTitle } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { layanan as copy } from '~/copy/layanan';
import useSession from '~/hooks/auth/useSession';
import { servicesByGroup, type Service, type ServiceId } from '~/lib/services';
import { curhatUnreadQuery } from './queries';
import {
  curhatUnreadTotal,
  openFormsCount,
  serviceBadge,
  type ServiceBadge,
} from './rules';

function Badge({ badge }: { badge: ServiceBadge | null }) {
  if (!badge) return null;
  if (badge.kind === 'count')
    return (
      <Count
        value={badge.value}
        label={fill(copy.pesanBaru, { jumlah: badge.value })}
      />
    );
  return (
    <Tag tone="accent">{fill(copy.belumDiisi, { jumlah: badge.value })}</Tag>
  );
}

/** One service (garis/screens-more.js `svcRow`): icon tile, the members' name, its description, then a badge and a
 * chevron, or the external mark for a site outside PIPS! (a new tab). */
function ServiceRow({
  service: s,
  badge,
}: {
  service: Service;
  badge: ServiceBadge | null;
}) {
  const Icon = ICONS[s.icon];
  const inner = (
    <span className="g-svc-row">
      <Tile>
        <Icon size={20} />
      </Tile>
      <span className="min-w-0 grow">
        <span className="block t-sub">{s.label}</span>
        <span className="block t-cap text-fg-2">{s.description}</span>
      </span>
      <Badge badge={badge} />
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

/**
 * Layanan (garis/screens-more.js `scrLayanan`, `serviceGroups`): the registry's groups in order, then Kelola for
 * pengurus through the capability map. No search box (owner, 2026-10-12): global search finds services too. One
 * column on phones and tablets, two on desktop.
 */
export function LayananScreen() {
  const me = useSession();
  const unread = useQuery(curhatUnreadQuery());
  const forms = useQuery(formListQuery());
  const groups = servicesByGroup(me);
  const data = {
    unread: unread.data ? curhatUnreadTotal(unread.data) : undefined,
    openForms: forms.data ? openFormsCount(forms.data.forms) : undefined,
  };

  return (
    <>
      <DeskHead title={common.nav.layanan} />
      <PageBody wide className="gap-5">
        <PageTitle className="lg:hidden">{common.nav.layanan}</PageTitle>
        <div className="g-svc-cols">
          {groups.map((g) => (
            <div key={g.group}>
              <SectionHead title={g.group} />
              <RuledList>
                {g.services.map((s) => (
                  <ServiceRow
                    key={s.id}
                    service={s}
                    badge={serviceBadge(s.id as ServiceId, data)}
                  />
                ))}
              </RuledList>
            </div>
          ))}
        </div>
      </PageBody>
    </>
  );
}
