/*
 * Who may open a Kelola page. Loaders read it, so it stays apart from the rest of Kelola's rules: the capability map
 * decides, never a role list of its own.
 */
import { can } from '~/lib/capabilities';
import { visibleServices, type Service } from '~/lib/services';

type WithRoles = { roles?: readonly string[] | null } | null | undefined;

export type KelolaPage = 'hub' | 'live' | 'sparta' | 'curhat';

/** The Kelola rows this member has, in the registry's order (the hub and Layanan's Kelola group). */
export function kelolaServices(user: WithRoles, now = new Date()): Service[] {
  return visibleServices(user, now).filter((s) => s.group === 'Kelola');
}

/**
 * Whether `user` may open a Kelola page; otherwise where to send them (with `replace`): to the hub when they have
 * another Kelola tool, else to Layanan.
 */
export function kelolaAccess(
  user: WithRoles,
  page: KelolaPage,
  now = new Date(),
): { allowed: true } | { allowed: false; to: '/kelola' | '/layanan' } {
  const hasKelola = kelolaServices(user, now).length > 0;
  const allowed =
    page === 'hub'
      ? hasKelola
      : page === 'live'
        ? can(user, 'liveCounting')
        : page === 'curhat'
          ? can(user, 'respondCurhat')
          : can(user, 'spartaData');
  if (allowed) return { allowed: true };
  return {
    allowed: false,
    to: page !== 'hub' && hasKelola ? '/kelola' : '/layanan',
  };
}

/**
 * Where the gate sends a member who may not open the page, once the session check has answered in this visit
 * (`checked`); null meanwhile, and when they may. The saved member may lack a role just given.
 */
export function gateRedirect(
  access: ReturnType<typeof kelolaAccess>,
  checked: boolean,
): '/kelola' | '/layanan' | null {
  return access.allowed || !checked ? null : access.to;
}

/** Page sizes: the recap's page and the live page's newest responses. */
export const REKAP_PAGE_SIZE = 20;
export const LATEST_COUNT = 5;
