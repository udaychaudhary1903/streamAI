import { DEFAULT_LIMIT } from "@/src/constants";
import { LikedView } from "@/src/modules/playlists/ui/views/liked-view";
import { HydrateClient, trpc } from "@/src/trpc/server";

export const dynamic = "force-dynamic";

const Page = async () => {
  void trpc.playlists.getLiked.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return ( 
    <HydrateClient>
      <LikedView />
    </HydrateClient>
  );
}
 
export default Page;