/**
 * The feed's view lives in the URL (P0-B's `pengumumanSearchSchema`, today's names), on the `/pengumuman` layout
 * route, so the post and the composer keep it and a reload restores it. Also the little memory the screens share
 * across a navigation: which card to give focus back to, and whether the desktop view just changed.
 */
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { canonicalView, type FeedView } from './rules';

export const LAYOUT_ID = '/_app/_left-navbar/pengumuman' as const;

/** The view as links carry it, so the post and the composer keep it. */
export type FeedSearch = FeedView;

export function useFeedView(): FeedView {
  return useSearch({ from: LAYOUT_ID });
}

/** Change the view, keeping the page (the desktop post stays selected while it is still in the list). */
export function useSetView() {
  const navigate = useNavigate();
  return useCallback(
    (patch: Partial<FeedView> | null) => {
      viewChanged = true;
      void navigate({
        to: '.',
        search: (prev: FeedView) => {
          const next = patch === null ? {} : { ...prev, ...patch };
          const v = canonicalView(next);
          return {
            search: next.search || undefined,
            unread: v.unread,
            excludeCategories: v.excludeCategories,
            sort: v.sort,
          };
        },
        replace: true,
      });
    },
    [navigate],
  );
}

/** Set when the member changes the view; the desktop pane then moves to the first post if its own left the list. */
let viewChanged = false;
export const takeViewChanged = () => {
  const v = viewChanged;
  viewChanged = false;
  return v;
};

/** Back from a post on phones and tablets gives focus to its card's link (the prototype's `back`). */
let returnTo: string | null = null;
export const rememberCard = (id: string) => {
  returnTo = id;
};
export const takeCard = () => {
  const id = returnTo;
  returnTo = null;
  return id;
};

/** The card's comment button opens the post with the comment field focused. */
let commentFor: string | null = null;
export const wantComment = (id: string) => {
  commentFor = id;
};
export const takeWantComment = (id: string) => {
  const want = commentFor === id;
  commentFor = null;
  return want;
};

/**
 * After the shell has moved focus to the page's title (its next frame), put it where the action wants it. The
 * element may render a little later (the list refetching after a post), or be replaced as it re-renders, dropping
 * focus to the page: for a short while it keeps trying, until the member taps or types.
 */
export function focusSoon(
  find: () => HTMLElement | null | undefined,
  within = FOCUS_WINDOW_MS,
) {
  const until = performance.now() + within;
  let acted = false;
  let placed = false;
  const stop = () => {
    acted = true;
  };
  window.addEventListener('pointerdown', stop, true);
  window.addEventListener('keydown', stop, true);
  const done = () => {
    window.removeEventListener('pointerdown', stop, true);
    window.removeEventListener('keydown', stop, true);
  };
  const tick = () => {
    if (acted || performance.now() > until) return done();
    const el = find();
    const active = document.activeElement;
    const lost = !active || active === document.body;
    if (el && active !== el && (!placed || lost)) {
      el.focus();
      placed ||= document.activeElement === el;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(() => requestAnimationFrame(tick));
}

/** How long focusSoon keeps an element in focus while the page settles. */
export const FOCUS_WINDOW_MS = 1500;
