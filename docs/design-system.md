# Design system: Garis

Garis is the look of PIPS!, written by hand for HMIF: tokens, type, components and icons. The look is settled;
this page is for building with it, not changing it. A change to how the app looks is a decision for the maintainers,
so open an issue with the Idea form first. Why it is hand-made is in
[decision 14](adr/0014-the-design-system-is-written-by-hand.md); the words are in [CONTEXT.md](../CONTEXT.md).

Almost every rule below is enforced by a lint rule or a test. `pnpm check` runs the lint rules; `pnpm test` runs the
tests. The last column of each table says which, so you can read the rule's own file.

## See it

Run the web app and open **http://localhost:5173/dev/garis**. It shows every token, type style, icon, brand mark and
component in light and dark. It exists only in development builds: a production build redirects it home
(`apps/web/src/routes/dev/garis.tsx`, and `apps/web/scripts/verify-production-bundle.mjs` checks it is not shipped).
The page's code is `apps/web/src/dev/garis/Gallery.tsx`; copy a component's usage from there.

## Where things are

| What | Where |
| --- | --- |
| Tokens (colour, lines, shadows, radii, layers), light and dark | `apps/web/src/styles/garis/tokens.css` |
| Type styles | `apps/web/src/styles/garis/type.css` |
| Component, shell, form and screen styles | `apps/web/src/styles/garis/*.css` |
| Fonts (self-hosted) | `apps/web/public/fonts/`, declared in `styles/garis/fonts.css` |
| Components | `apps/web/src/components/garis/`, all exported from `index.ts` |
| Icons | `apps/web/src/components/icons/`, one file each; `registry.ts` lists them |
| The official logo | `apps/web/public/logo/hmif.png`, shown only by `components/garis/HmifLogo.tsx` |

## Tokens

Colour comes only from tokens, never from a value you write. In a class name:

- backgrounds: `bg-surface`, `bg-app`, `bg-muted`, `bg-accent` (HMIF gold) and the other `bg-*` names in `tokens.css`
- text: `text-fg`, `text-fg-2`, `text-fg-3`, `text-danger`, `text-success`
- lines: `border-line`, `border-strong`; the focus ring: `ring-focus`

In a CSS file, use `var(--text)`, `var(--bg-surface)` and so on. Backgrounds, text and lines are separate scales, so a
text colour cannot be used as a background by mistake. Dark mode is the `.dark` class on `<html>`; tokens change
under it, so a component needs no dark-mode code. A small script in `index.html` sets the class before the first
paint, so the page never flashes the wrong theme. Corners are `rounded-tag`, `rounded-control`, `rounded-list`,
`rounded-card` and `rounded-sheet`. Floating things take their layer from the scale in `tokens.css` (`--z-scrim`,
`--z-modal`, `--z-popper`, `--z-toast`); do not write a `z-index` number.

## Type

Nine sizes, from 12 to 32 px, and a 56 px figure, each a style named `t-…`: `t-display-l`, `t-display`, `t-title`,
`t-heading`, `t-body-l`, `t-body`, `t-sub`, `t-sm`, `t-label`, `t-cap`, `t-micro`, `t-figure`, `t-figure-xl`. Pick a
style; do not set a size. Two faces:

- **Archivo Expanded** (`t-display`, `t-display-l`, `disp`): page titles, the greeting, the wordmark and the member
  card's name. Nowhere else.
- **Geist**: everything else, including student numbers, course codes and times (use `num` or `code` for tabular
  digits).

Sentence case everywhere. The app never adds capitals by styling, and never uses monospace.

## Components

Build screens from `~/components/garis`, not from raw elements, when a component exists:

| Need | Component |
| --- | --- |
| Actions | `Button` (`gold` is the one main action, `paper`, `ghost`, `danger`), `LinkButton`, `IconButton` |
| Inputs | `Field`, `Input`, `Textarea`, `Select`, `Searchbox`, `Checkbox`, `Radio`, `Switch`, `Seg`, `Rating`, `Options` |
| Dialogs | `Dialog`, `Sheet` (a bottom sheet on a phone), `Modal`, `ConfirmDialog`, `Popover`, `Menu` |
| Lists and surfaces | `Item`, `RuledList`, `FactsList`, `SectionHead`, `Card`, `Tile`, `Plaque`, `Media`, `Disclosure` |
| Marks | `Tag`, `StatusTag`, `Chip`, `Count`, `Due`, `Avatar`, `PixelReaction`, `Reactions`, `Wordmark`, `HmifLogo` |
| Feedback | `toast(...)` with one `Toaster` at the root, `Skeleton*`, `EmptyState`, `ErrorState`, `OfflineBanner` |

Every list screen needs all of: loading (`Skeleton*`), empty (`EmptyState`), and error with "Coba lagi"
(`ErrorState`). Status is always an icon, a word and a colour together (`StatusTag` does it); colour alone is never the
message. On touch layouts every control has a hit area of at least 44 px (`styles/garis/components.css`).
Dialogs and menus use Radix (a library of behaviour with no styling: focus trap, escape, return of focus) inside
our own components; Radix is not a look.

## Icons

Use the Garis icons only: `import { IconKalender } from '~/components/icons/kalender'`. Import one icon from its own
file, not from a barrel, so a page does not carry the others. Sizes are 16, 20 or 24 (`size` rounds to the nearest of
the three); the stroke renders at 1.5 px, 2 px inside buttons and on the active tab; the colour is the text colour
(`currentColor`). An icon beside a word is hidden from screen readers; one that stands alone needs a `title`. Never
use an icon library, an emoji or an `<img>` as an icon. To add an icon, draw it on the same 24 px grid; the icon files
are generated by `apps/web/scripts/garis/gen-icons.mjs`, so ask a maintainer before adding one.

## The logo

HMIF's logo is only the official file `/logo/hmif.png`, whole: never redrawn, cropped, recoloured, stretched,
outlined or covered, and at least 40 px wide. Show it with `<HmifLogo width={54} />`; on a gold background, add
`plate`. Do not imitate parts of it either: no vertical "HIMPUNAN", no copied lettering, no bars taken from it. The
app icons are made from the same file.

## Words

Every sentence the app shows lives in `apps/web/src/copy/`, one file per area. A component imports it
(`import { masuk } from '~/copy/masuk'`), and a sentence with a gap uses `fill()`
(`fill(common.shell.kembaliKe, { judul: 'Beranda' })` for `'Kembali ke {judul}'`). The voice is Indonesian and
friendly, speaking to the member as **kamu** ("Periksa koneksimu", never "Anda"). An error says what happened, then
what to do. Keep members' own service names exactly (Ding Dong, Testi Matkul, NIM Finder, Info Lomba, Curhat Yuk!), and
use the house terms in `copy/glossary.ts` (Beranda, not "Home"; Masuk, not "Login"). Add a new house term in its
own commit.

The interface says it: no small label above a title that the title already says, no caption that repeats what a
control shows, no count or pill that adds nothing. Keep text that prevents a mistake, such as a validation error, a
warning before something cannot be undone, or a privacy note.

## What enforces what

| Rule | Enforced by |
| --- | --- |
| No raw colour (hex, `rgb()`, `hsl()`, Tailwind palette, arbitrary colour) in code | lint rule `garis/no-raw-colour` (`apps/web/eslint-rules/garis.mjs`) |
| Only Garis type styles, no arbitrary text size | `garis/no-arbitrary-text-size` |
| No capitals added by styling (`uppercase`, `capitalize`, `text-transform`) | `garis/no-added-capitals`; for CSS files `tests/garis-css-all.test.mjs` |
| No `transition: all` | `garis/no-transition-all`; `tests/garis-css-all.test.mjs` |
| No monospace | `garis/no-monospace`; `tests/garis-fonts.test.mjs`; `e2e/qa/screens.spec.ts` |
| No `<img>` as an icon, no icon library | `garis/no-img-icon`, `garis/no-icon-library` (all of `src`, the generated client aside) |
| Every stylesheet uses tokens only, text at least 12 px | `tests/garis-css-all.test.mjs` |
| Contrast: text 4.5:1, boundaries and focus ring 3:1, in both themes | `tests/garis-tokens.test.mjs` (reads `tokens.css`) |
| Floating layers come from one scale | `tests/garis-tokens.test.mjs`, `tests/garis-shell-css.test.mjs` |
| The icons are the drawn set, on the 24 px grid, `currentColor`, three sizes | `tests/garis-icons.test.mjs` |
| Fonts are self-hosted, within size limits, with no request to another site | `tests/garis-fonts.test.mjs` |
| The theme script agrees with the app's theme rules | `tests/garis-theme.test.mjs` |
| Components do nothing when imported (so a page carries only what it uses) | `tests/garis-pure.test.mjs` |
| The logo is the official file, whole; app icons contain it unaltered | `garis/no-img-icon` (only `HmifLogo.tsx`, `Surface.tsx`, `Avatar.tsx` may use `<img>`); `tests/pwa-icons.test.mjs`; `e2e/qa/screens.spec.ts` |
| Archivo Expanded only on titles, the greeting, the wordmark and the member card | `e2e/qa/screens.spec.ts` (in CI) |
| Words follow the glossary; banned words, service names and added capitals | `tests/copy.test.ts` with `src/copy/glossary.ts` |
| Accessibility, 12 px text, visible focus, no sideways scroll on every screen | the gates, `e2e/support/strict.ts` (see [testing](testing.md)) |

Not enforced by any check, so review them by eye: the content rule (no repeated labels or captions), the *kamu*
voice beyond the banned word "Anda", "status is icon plus word plus colour" for a status built without `StatusTag`,
and the 44 px touch hit area on a new control.
