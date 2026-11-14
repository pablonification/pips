import { useQuery } from '@tanstack/react-query';
import Markdown from 'markdown-to-jsx';
import { useMemo, type ReactNode } from 'react';
import { creditsQuery } from '~/api/queries';
import {
  Avatar,
  Card,
  ErrorState,
  RuledList,
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
  parseCredits,
  personLine,
  runs,
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

function Person({ p, photos }: { p: CreditPerson; photos: Photos }) {
  return (
    <li className="g-kredit-person">
      <Avatar initials={initialsOf(p.name)} picture={photos[p.nim]} />
      <span className="min-w-0">
        <span className="block t-sub">{p.name}</span>
        <span className="block t-cap text-fg-2 num">{personLine(p)}</span>
      </span>
    </li>
  );
}

function Section({
  s,
  role,
  photos,
}: {
  s: CreditSection;
  role: boolean;
  photos: Photos;
}) {
  return (
    <Card className={cn('g-kredit-card', role && 'role')}>
      <h3 className={role ? 't-label text-fg-2' : 't-heading'}>{s.title}</h3>
      {s.parts.map((part, i) => (
        <div key={i} className="g-kredit-part">
          {part.label ? (
            <h4 className="t-micro text-fg-3">{part.label}</h4>
          ) : null}
          <RuledList>
            {part.people.map((p) => (
              <Person key={`${p.nim}-${p.name}`} p={p} photos={photos} />
            ))}
          </RuledList>
        </div>
      ))}
    </Card>
  );
}

/** The credits as a designed page: a group's title, its roles as small cards, its teams as cards with Lead and Team. */
function Credits({
  groups,
  photos,
}: {
  groups: CreditGroup[];
  photos: Photos;
}) {
  return (
    <div className="g-kredit">
      {groups.map((g, i) => (
        <section key={i} className="grid gap-3.5">
          {g.title ? <h2 className="t-title">{g.title}</h2> : null}
          {runs(g.sections).map((run, j) => (
            <div key={j} className={cn('g-kredit-grid', run.role && 'roles')}>
              {run.sections.map((s, k) => (
                <Section key={k} s={s} role={run.role} photos={photos} />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Profil › Kredit: `GET /api/markdown/credits`. Credits in the shape `parseCredits` knows show as cards, each person
 * with their photo when they have one; anything else renders as markdown. Either way without the text's own "Credits" title: the page's title says it.
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
