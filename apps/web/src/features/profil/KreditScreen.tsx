import { useQuery } from '@tanstack/react-query';
import Markdown from 'markdown-to-jsx';
import type { ReactNode } from 'react';
import { creditsQuery } from '~/api/queries';
import {
  ErrorState,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { profil } from '~/copy/profil';

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

/** Profil › Kredit: `GET /api/markdown/credits` (a toast in the prototype; OPEN-QUESTIONS D3). */
export function KreditScreen() {
  const credits = useQuery(creditsQuery());
  return (
    <>
      <DeskHead title={common.shell.kredit} />
      <PageBody className="gap-3.5">
        {credits.data ? (
          <div className="grid gap-3">
            <Markdown options={{ overrides, forceBlock: true }}>
              {credits.data.content}
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
