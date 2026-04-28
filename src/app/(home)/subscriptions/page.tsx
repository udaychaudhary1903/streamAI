import { DEFAULT_LIMIT } from "@/src/constants";
import { HydrateClient, trpc } from "@/src/trpc/server";

import { SubscriptionsView } from "@/src/modules/subscriptions/ui/views/subscriptions-view";

const Page = async () => {
  void trpc.subscriptions.getMany.prefetchInfinite({
    limit: DEFAULT_LIMIT,
  });

  return ( 
    <HydrateClient>
      <SubscriptionsView />
    </HydrateClient>
   );
};
 
export default Page;