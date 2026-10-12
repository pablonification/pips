import {
  isEligibleFor,
  windowStatus,
  type WindowStatus,
} from './programme-window';

/** Magang SPARTA is for angkatan 2025, plus these manually approved exceptions. */
export const ELIGIBLE_SPARTA_ANGKATAN = [2025];

// Manually approved exceptions: these NIMs are not angkatan 2025 but have
// been designated eligible for the SPARTA internship form regardless.
export const ELIGIBLE_SPARTA_NIM_OVERRIDES = [
  '13524108', // Daffa Mutaqin Tetaputra
  '18224053', // Nathan Pasha Athallah
  '18224112', // Muhammad Reyna Athallah Agoes
];

/**
 * When SPARTA takes applications, on the server's clock. It closed Minggu, 23 Agustus 2026, 23.59 WIB (the date
 * today's client hard-coded); the next season's dates aren't known, so it has no opening time.
 */
export const SPARTA_WINDOW = {
  opensAt: null as Date | null,
  closesAt: new Date('2026-08-23T23:59:00+07:00'),
};

export function isSpartaEligible(user: { angkatan: number; nim: string }) {
  return isEligibleFor(
    {
      eligibleAngkatan: ELIGIBLE_SPARTA_ANGKATAN,
      eligibleNims: ELIGIBLE_SPARTA_NIM_OVERRIDES,
    },
    user,
  );
}

export interface SpartaWindow {
  opensAt: Date | null;
  closesAt: Date | null;
  status: WindowStatus;
  eligible: boolean;
}

/** SPARTA's window as one member sees it (`GET /internship/window`). */
export function spartaWindowFor(
  user: { angkatan: number; nim: string },
  now: Date | number = Date.now(),
  window: { opensAt: Date | null; closesAt: Date | null } = SPARTA_WINDOW,
): SpartaWindow {
  return {
    opensAt: window.opensAt,
    closesAt: window.closesAt,
    status: windowStatus(window, now),
    eligible: isSpartaEligible(user),
  };
}
