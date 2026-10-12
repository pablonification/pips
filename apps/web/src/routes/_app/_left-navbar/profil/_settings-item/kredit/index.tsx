import { useQuery } from '@tanstack/react-query';
import { queryClient } from '~/api/client';
import { creditsQuery } from '~/api/queries';
import { createFileRoute } from '@tanstack/react-router';
import Markdown from 'markdown-to-jsx';
import { api } from '~/api/client';

export const Route = createFileRoute(
  '/_app/_left-navbar/profil/_settings-item/kredit/',
)({
  // Fetched while the page's code downloads; the page picks up the same request.
  loader: () => void queryClient.prefetchQuery(creditsQuery()),
  component: CreditsPage,
});

function CreditsPage() {
  const { data: credits } = useQuery({
    queryKey: ['credits'],
    queryFn: () => api.markdown.getCredits(),
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (!credits) return null;
  return (
    <div className="relative prose prose-sm text-center prose-invert prose-h4:mt-2 prose-p:my-0 prose-p:text-white">
      <Markdown>{credits.content}</Markdown>
    </div>
  );
}
