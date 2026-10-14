import { useQuery } from '@tanstack/react-query';
import { formListQuery } from '~/api/queries';
import { Count, RuledList, SectionHead, Tag } from '~/components/garis';
import { DESKTOP_QUERY, useMediaQuery } from '~/components/garis/useMediaQuery';
import { DeskHead, PageBody, PageTitle } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { layanan as copy } from '~/copy/layanan';
import useSession from '~/hooks/auth/useSession';
import { curhatUnreadQuery } from '~/api/queries';
import { totalUnread } from '~/lib/curhat-unread';
import { servicesByGroup, type ServiceId } from '~/lib/services';
import { ServiceRow } from './ServiceRow';
import { openFormsCount, serviceBadge, type ServiceBadge } from './rules';

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
  // The page's title once: the desk head's from 1024 px, this one below (F2-003; it was hidden by CSS on desktop).
  const desk = useMediaQuery(DESKTOP_QUERY);
  const data = {
    unread: unread.data ? totalUnread(unread.data) : undefined,
    openForms: forms.data ? openFormsCount(forms.data.forms) : undefined,
  };

  return (
    <>
      <DeskHead title={common.nav.layanan} />
      <PageBody wide className="gap-5">
        {desk ? null : <PageTitle>{common.nav.layanan}</PageTitle>}
        <div className="g-svc-cols">
          {groups.map((g) => (
            <div key={g.group}>
              <SectionHead title={g.group} />
              <RuledList>
                {g.services.map((s) => (
                  <ServiceRow
                    key={s.id}
                    service={s}
                    badge={
                      <Badge badge={serviceBadge(s.id as ServiceId, data)} />
                    }
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
