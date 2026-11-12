# 14. The design system, Garis, is written by hand

Status: accepted.

## Context
HMIF wanted the app to look like HMIF, not like a template: its own gold and ink colours, two typefaces, its own
icons and its own small details. Ready-made libraries (Material, shadcn/ui) look like themselves.

## Decision
- **Garis** is the app's design system, in this repository:
  - tokens (colours and sizes, for light and dark) in `apps/web/src/styles/garis/tokens.css`, with type, components,
    shell and fonts beside it;
  - components in `apps/web/src/components/garis/` (Button, Field, Overlay, Menu, Toast, and so on);
  - icons in `apps/web/src/components/icons/`, one file each. No icon library.
- Radix UI is used underneath for the hard behaviour of dialogs, menus and popovers only.
- Rules that keep it whole are lint rules in `apps/web/eslint-rules/garis.mjs`, switched on in
  `apps/web/eslint.config.js`: no raw colour values, no arbitrary text sizes, no `transition: all`, no image icons,
  no icon library, no monospace font, no capitals added by the app.
- HMIF's logo is only ever the official file, shown whole.

## What else was possible
- shadcn/ui, Material or another library with a stock icon set: faster to start and less to maintain, but not
  HMIF's look.

## What it costs
- Every new component is HMIF's to write, test and keep accessible. `components.css` alone is well over a thousand
  lines.
- The class-name lint rule carries a list of allowed short names in `eslint.config.js` that grows with each feature.
- A contributor cannot paste in a component from a library; it has to be built from Garis parts.

## When to revisit
When keeping the components accessible costs more than the identity is worth, or when a library offers the same
look. Until then the lint rules are what protect the design from drifting.
