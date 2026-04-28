import { DEFAULT_LIMIT } from "@/src/constants";
import { HistoryView } from "@/src/modules/playlists/ui/views/history-view";
import { HydrateClient, trpc } from "@/src/trpc/server";

export const dynamic = "force-dynamic";

const Page = async () => {
  void trpc.playlists.getHistory.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return ( 
    <HydrateClient>
      <HistoryView />
    </HydrateClient>
  );
}
 
export default Page;