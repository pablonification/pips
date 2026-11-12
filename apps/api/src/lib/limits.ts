/** Text and request limits the API enforces itself, whatever a client sends. */

/** A post's title and text, as the composer allows (apps/web/src/lib/constants.ts). */
export const MAX_POST_TITLE = 100;
export const MAX_POST_CONTENT = 1000;
/** A comment, and a Curhat message: the app sets none, so these sit far above anything typed by hand. */
export const MAX_COMMENT = 2000;
export const MAX_CURHAT_MESSAGE = 5000;

/** Any request body, in bytes. The largest real ones (a long form or SPARTA answer) are a few tens of KiB. */
export const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Rate limits, per minute. Generous: a member reading, reacting, commenting and posting quickly stays far below
 * them, and a campus network shares one address among many members for sign-in.
 */
export const RATE_LIMITS = {
  /** Sign-in requests, per client address. */
  signIn: 300,
  /** Requests that change something, per signed-in member (per address without a session). */
  writes: 300,
  /** Link previews (each fetches a page elsewhere), per member. */
  previews: 120,
  /** Curhat messages on the socket, per member (Welfare's replies too): each is saved and pushed. */
  curhatMessages: 30,
};
export const RATE_WINDOW_MS = 60_000;
