import { HydrateClient, trpc } from "@/src/trpc/server";

import { VideoView } from "@/src/modules/videos/ui/views/video-view";
import { DEFAULT_LIMIT } from "@/src/constants";

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{
    videoId: string;
  }>;
}

const Page = async ({ params }: PageProps) => {
  const { videoId } = await params;

  void trpc.videos.getOne.prefetch({ id: videoId });
  void trpc.comments.getMany.prefetchInfinite({ videoId, limit: DEFAULT_LIMIT });
  void trpc.suggestions.getMany.prefetchInfinite({ videoId, limit: DEFAULT_LIMIT });

  return ( 
    <HydrateClient>
      <VideoView videoId={videoId} />
    </HydrateClient>
  );
};
 
export default Page;