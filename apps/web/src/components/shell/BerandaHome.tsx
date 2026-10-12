/**
 * Beranda's frame (the prototype's `scrBeranda` around its content). On phones and tablets: the gold header under
 * the shell's gold bar, with the greeting and the halftone growing toward its right edge (never HMIF's logo), then
 * the page body. `agenda` (P1-A's card) overlaps the header's lower edge. On desktop: the greeting as the page head.
 *
 * ```tsx
 * <BerandaHome agenda={<AgendaCard />}>
 *   <ServiceTiles />
 *   …
 * </BerandaHome>
 * ```
 */
import type { ReactNode } from 'react';
import { Halftone } from '~/components/garis';
import { DESKTOP_QUERY, useMediaQuery } from '~/components/garis/useMediaQuery';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import useSession from '~/hooks/auth/useSession';
import { firstNameOf } from '~/lib/shell/names';
import { cn } from '~/lib/utils';
import { DeskHead, PageBody, PageTitle } from './page';

export function BerandaHome({
  agenda,
  children,
}: {
  agenda?: ReactNode;
  children?: ReactNode;
}) {
  const user = useSession();
  const desk = useMediaQuery(DESKTOP_QUERY);
  const greeting = fill(common.shell.halo, {
    nama: firstNameOf(user.fullName),
  });
  // One tree on every layout (review M2): P1-A's agenda and content keep their place, and their state, when the
  // width crosses 1024 px; only the head changes (the gold header below 1024 px, the desktop head from there).
  return (
    <div className="g-home">
      {desk ? (
        <DeskHead title={greeting} />
      ) : (
        <div className={cn('g-hero', agenda ? 'lap' : undefined)}>
          <span className="g-hero-ht">
            <Halftone length={216} />
          </span>
          <PageTitle className="g-hero-hi">{greeting}</PageTitle>
        </div>
      )}
      {agenda ? (
        <PageBody className="g-home-agenda pt-0">
          <div className="g-lap">{agenda}</div>
        </PageBody>
      ) : null}
      {children}
    </div>
  );
}
