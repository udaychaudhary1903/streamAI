import { DEFAULT_LIMIT } from "@/src/constants";
import { SubscribedView } from "@/src/modules/home/ui/views/subscribed-view";

import { HydrateClient, trpc } from "@/src/trpc/server";

export const dynamic = "force-dynamic";

const Page = async () => {
  void trpc.videos.getManySubscribed.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <SubscribedView />
    </HydrateClient>
  );
};

export default Page;