/**
 * Desktop Kalender's side column chooses an event by itself when none is in the URL (`deskDefaultEvent`). A screen
 * inside Kalender can ask it to choose nothing instead (P3-B: after adding an event that isn't in your calendar, and
 * after deleting one), as the prototype's `S.deskEv = null`.
 */
import { createContext, useContext } from 'react';
import type { DeskPick } from './rules';

export const DeskPickContext = createContext<((pick: DeskPick) => void) | null>(
  null,
);

export const useDeskPick = () => useContext(DeskPickContext);
