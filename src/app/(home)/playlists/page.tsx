import { DEFAULT_LIMIT } from "@/src/constants";
import { HydrateClient, trpc } from "@/src/trpc/server";
import { PlaylistsView } from "@/src/modules/playlists/ui/views/playlists-view";

export const dynamic = "force-dynamic";

const Page = async () => {
  void trpc.playlists.getMany.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return ( 
    <HydrateClient>
      <PlaylistsView />
    </HydrateClient>
  );
};
 
export default Page;