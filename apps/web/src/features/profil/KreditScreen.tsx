import { useQuery } from '@tanstack/react-query';
import Markdown from 'markdown-to-jsx';
import { useMemo, type ReactNode } from 'react';
import { creditsQuery } from '~/api/queries';
import {
  Avatar,
  Card,
  ErrorState,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { profil } from '~/copy/profil';
import { initialsOf } from '~/lib/shell/names';
import { cn } from '~/lib/utils';
import {
  dropTitle,
  isRole,
  newestFirst,
  parseCredits,
  personLine,
  type CreditGroup,
  type CreditPerson,
  type CreditSection,
} from './credits';

type Props = { children?: ReactNode };

/*
 * The server's credits in Garis type. The page's title is the page's h1, so the markdown's headings start one
 * level below it. This route is the only one that loads the markdown renderer (its own chunk).
 */
const overrides = {
  h1: { component: (p: Props) => <h2 className="t-title">{p.children}</h2> },
  h2: { component: (p: Props) => <h3 className="t-heading">{p.children}</h3> },
  h3: { component: (p: Props) => <h4 className="t-sub">{p.children}</h4> },
  h4: { component: (p: Props) => <h5 className="t-sub">{p.children}</h5> },
  p: {
    component: (p: Props) => <p className="t-body text-fg-2">{p.children}</p>,
  },
  a: {
    component: (p: Props & { href?: string }) => (
      <a
        className="g-link in-text"
        href={p.href}
        target="_blank"
        rel="noopener"
      >
        {p.children}
      </a>
    ),
  },
  ul: {
    component: (p: Props) => (
      <ul className="grid list-disc gap-1 pl-5 t-body">{p.children}</ul>
    ),
  },
  ol: {
    component: (p: Props) => (
      <ol className="grid list-decimal gap-1 pl-5 t-body">{p.children}</ol>
    ),
  },
};

/** The credited members' photos by NIM (`photos` of `GET /api/markdown/credits`); initials for anyone without one. */
type Photos = Record<string, string>;

function Person({
  p,
  photos,
  face,
}: {
  p: CreditPerson;
  photos: Photos;
  face?: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <Avatar
        initials={initialsOf(p.name)}
        picture={photos[p.nim]}
        className={face}
      />
      <span className="min-w-0">
        <span className="block t-sub">{p.name}</span>
        <span className="block t-cap text-fg-2 num">{personLine(p)}</span>
      </span>
    </li>
  );
}

function Parts({
  s,
  photos,
  face,
}: {
  s: CreditSection;
  photos: Photos;
  face?: string;
}) {
  return s.parts.map((part, i) => (
    <div key={i} className="grid gap-1.5">
      {part.label ? <h4 className="t-micro text-fg-3">{part.label}</h4> : null}
      <ul className="g-kredit-people">
        {part.people.map((p) => (
          <Person
            key={`${p.nim}-${p.name}`}
            p={p}
            photos={photos}
            face={face}
          />
        ))}
      </ul>
    </div>
  ));
}

/** The newest group: a large card per role or team. One person alone in a role sits beside a large photo. */
function Feature({ s, photos }: { s: CreditSection; photos: Photos }) {
  const solo = isRole(s) && s.parts[0].people.length === 1;
  if (solo) {
    const p = s.parts[0].people[0];
    return (
      <Card className="g-kredit-card grid gap-3">
        <ul>
          <li className="flex items-center gap-4">
            <Avatar
              initials={initialsOf(p.name)}
              picture={photos[p.nim]}
              className="g-kredit-big"
            />
            <span className="min-w-0">
              <h3 className="t-cap text-fg-2">{s.title}</h3>
              <span className="block t-title">{p.name}</span>
              <span className="block t-cap text-fg-2 num">{personLine(p)}</span>
            </span>
          </li>
        </ul>
      </Card>
    );
  }
  return (
    <Card className="g-kredit-card grid gap-3">
      <h3 className="t-label text-fg-2">{s.title}</h3>
      <Parts s={s} photos={photos} face="g-kredit-mid" />
    </Card>
  );
}

/** An older group's role or team: its name, then its people beside it from the tablet up. */
function Row({ s, photos }: { s: CreditSection; photos: Photos }) {
  return (
    <div className="g-kredit-row grid">
      <h3 className="t-label text-fg-2">{s.title}</h3>
      <div className="grid gap-3">
        <Parts s={s} photos={photos} />
      </div>
    </div>
  );
}

/**
 * The credits along a garis, newest group first: the newest as large cards, the older ones as rows. One group alone
 * has nothing to set apart, so it shows as rows with no line.
 */
function Credits({
  groups,
  photos,
}: {
  groups: CreditGroup[];
  photos: Photos;
}) {
  const line = groups.length > 1;
  return (
    <div className={cn('g-kredit grid', line && 'line')}>
      {newestFirst(groups).map((g, i) => {
        const featured = line && i === 0;
        return (
          <section
            key={i}
            className={cn(
              'relative grid content-start gap-3.5',
              featured && 'newest',
            )}
          >
            {line ? (
              <span className="g-kredit-mark" aria-hidden="true" />
            ) : null}
            {g.title ? <h2 className="t-title">{g.title}</h2> : null}
            {featured ? (
              <div className="g-kredit-feature">
                {g.sections.map((s, j) => (
                  <Feature key={j} s={s} photos={photos} />
                ))}
              </div>
            ) : (
              <div>
                {g.sections.map((s, j) => (
                  <Row key={j} s={s} photos={photos} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Profil › Kredit: `GET /api/markdown/credits`. Credits in the shape `parseCredits` knows show along a garis, each person
 * with their photo when they have one, newest group first; anything else renders as markdown. Either way without the text's own "Credits" title: the page's title says it.
 */
export function KreditScreen() {
  const credits = useQuery(creditsQuery());
  const content = credits.data?.content;
  const groups = useMemo(
    () => (content === undefined ? null : parseCredits(content)),
    [content],
  );
  return (
    <>
      <DeskHead title={common.shell.kredit} />
      <PageBody wide={groups !== null} className="gap-3.5">
        {groups ? (
          <Credits groups={groups} photos={credits.data?.photos ?? {}} />
        ) : credits.data ? (
          <div className="grid gap-3">
            <Markdown options={{ overrides, forceBlock: true }}>
              {dropTitle(credits.data.content)}
            </Markdown>
          </div>
        ) : credits.isError ? (
          <ErrorState
            title={profil.kredit.gagal}
            onRetry={() => void credits.refetch()}
            retrying={credits.isFetching}
          />
        ) : (
          <Skeleton>
            <div className="grid gap-3">
              <SkeletonBlock height={24} className="w-2/5" />
              <SkeletonBar width="90%" />
              <SkeletonBar width="70%" />
            </div>
          </Skeleton>
        )}
      </PageBody>
    </>
  );
}
