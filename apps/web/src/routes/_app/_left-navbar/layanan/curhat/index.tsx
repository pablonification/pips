import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { chatroomsQuery, prefetch } from '~/api/queries';
import { LegacyScreen } from '~/components/shell/page';
import { isWelfare } from '~/features/curhat/Area';
import { CurhatList } from '~/features/curhat/List';
import useSession from '~/hooks/auth/useSession';

// Welfare keeps today's screen until P3-C (loaded only for them, on its old light surface).
const WelfareCurhat = lazy(() =>
  import('./-components/welfare').then((m) => ({ default: m.WelfareCurhat })),
);

function CurhatIndex() {
  const me = useSession();
  if (!isWelfare(me)) return <CurhatList />;
  return (
    <LegacyScreen>
      <Suspense fallback={null}>
        <WelfareCurhat />
      </Suspense>
    </LegacyScreen>
  );
}

export const Route = createFileRoute('/_app/_left-navbar/layanan/curhat/')({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => prefetch(chatroomsQuery()),
  component: CurhatIndex,
});
