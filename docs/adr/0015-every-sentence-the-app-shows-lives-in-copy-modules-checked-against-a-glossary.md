# 15. Every sentence the app shows lives in copy modules, checked against a glossary

Status: accepted.

## Context
The app speaks Indonesian in one voice (informal, "kamu"), and members know the services by particular names ("Ding
Dong", "Curhat Yuk!"). Text scattered through components drifts: one screen says "Login", another says "Masuk".

## Decision
- All the app's sentences are in `apps/web/src/copy/`, one file per area, and components import them.
- `apps/web/src/copy/glossary.ts` lists the house terms, the words that must not be used (each with the term to use
  instead) and the proper nouns and acronyms that may carry capitals.
- `apps/web/tests/copy.test.ts` reads every copy module and fails on a banned word, a service name spelled
  differently from the service registry (see 0016), or capitals the app adds by itself.

## What else was possible
- Text written inside components: easier to read next to the layout, impossible to check as a whole.
- A translation library: there is one language, so it would only add weight.

## What it costs
- To change a word you edit a different file from the one that draws the screen.
- The glossary check knows words, not meaning. A sentence can be correct to the test and still wrong for HMIF.
- Adding a term or a banned word is a change to a shared file that many pull requests touch.

## When to revisit
When the app needs a second language (then a translation tool becomes worth it, and the copy modules are already
the place to start from).
