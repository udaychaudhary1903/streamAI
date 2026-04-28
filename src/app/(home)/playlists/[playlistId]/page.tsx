import { DEFAULT_LIMIT } from "@/src/constants";
import { HydrateClient, trpc } from "@/src/trpc/server";

import { VideosView } from "@/src/modules/playlists/ui/views/videos-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ playlistId: string }>;
}

const Page = async ({ params }: PageProps) => {
  const { playlistId } = await params;

  void trpc.playlists.getOne.prefetch({ id: playlistId });
  void trpc.playlists.getVideos.prefetchInfinite({ playlistId, limit: DEFAULT_LIMIT });

  return ( 
    <HydrateClient>
      <VideosView playlistId={playlistId} />
    </HydrateClient>
  );
}
 
export default Page;