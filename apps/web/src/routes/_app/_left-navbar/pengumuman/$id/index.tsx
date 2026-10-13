import { createFileRoute } from '@tanstack/react-router';
import { infoCommentsQuery, infoDetailQuery, prefetch } from '~/api/queries';
import { PostScreen } from '~/features/pengumuman/screens';

export const Route = createFileRoute('/_app/_left-navbar/pengumuman/$id/')({
  component: PostScreen,
  // Starts the post and its comments while the page's code downloads; the page picks up the same requests.
  loader: ({ params }) => {
    prefetch(infoDetailQuery(params.id));
    prefetch(infoCommentsQuery(params.id));
  },
});
