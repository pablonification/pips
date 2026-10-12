import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { api, queryClient } from '~/api/client';
import { infoCommentsQuery, infoDetailQuery } from '~/api/queries';
import { preloadImages } from '~/lib/image';
import CommentForm from './-components/comment-form';
import Comments from './-components/comments';
import DetailPost from './-components/detail-post';
import Header from './-components/header';
import PostInteraction from './-components/post-interaction';
import { emojiImages } from './-constants/emoji';
import { InfoShare } from '../-components/feed';

export const Route = createFileRoute('/_app/_left-navbar/pengumuman/$id/')({
  component: InfoDetail,
  beforeLoad() {
    preloadImages(Object.values(emojiImages));
  },
  // Starts the post and its comments while the page's code downloads; the page picks up the same requests.
  loader: ({ params }) => {
    void queryClient.prefetchQuery(infoDetailQuery(params.id));
    void queryClient.prefetchQuery(infoCommentsQuery(params.id));
  },
});

function InfoDetail() {
  const { id: infoId } = Route.useParams();
  const { data: info } = useQuery({
    ...infoDetailQuery(infoId),
  });
  const { data: comments } = useQuery({
    ...infoCommentsQuery(infoId),
  });

  useQuery({
    queryKey: ['readinfo', infoId],
    queryFn: () =>
      api.info.readInfo({ infoId, requestBody: { unread: false } }),
    enabled: !!info,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  const [activeReaction, setActiveReaction] = useState<string | null>(null);

  const toggleReaction = (key: string) => {
    if (activeReaction === key) {
      setActiveReaction(null);
    } else {
      setActiveReaction(key);
    }
  };

  if (!info) {
    // TODO: handle error or loading
    return <div className="flex-1"></div>;
  }

  return (
    <div className="w-full flex-1 pb-24 lg:pb-2">
      <Header />
      <div className="flex-col space-y-4 p-4">
        <DetailPost info={info} />
        <div className="flex items-center justify-between border-t border-[#EBEEEB]">
          <PostInteraction
            reactions={info.reactions}
            commentsCount={info.comments}
            isActive={activeReaction === 'post'}
            toggleReaction={() => toggleReaction('post')}
            infoId={info.id}
            isDetail
          />
          <InfoShare info={info} />
        </div>
        <CommentForm repliedInfoId={info.id} />
        {/* P.S. idk how i should generate the repliedInfoId, sorry. */}
        {comments && (
          <Comments
            comments={comments}
            activeReaction={activeReaction}
            toggleReaction={toggleReaction}
          />
        )}
      </div>
    </div>
  );
}
