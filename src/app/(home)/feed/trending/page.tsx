import { HydrateClient, trpc } from "@/src/trpc/server";

import { DEFAULT_LIMIT } from "@/src/constants";

import { TrendingView } from "@/src/modules/home/ui/views/trending-view";

export const dynamic = "force-dynamic";

const Page = async () => {
  void trpc.videos.getManyTrending.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <TrendingView />
    </HydrateClient>
  );
};

export default Page;