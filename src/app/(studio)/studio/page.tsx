import { DEFAULT_LIMIT } from "@/src/constants";
import { StudioView } from "@/src/modules/studio/ui/views/studio-view";
import { HydrateClient, trpc } from "@/src/trpc/server";

const Page = async () => {
    void trpc.studio.getMany.prefetchInfinite({
        limit: DEFAULT_LIMIT,
    });

    return (
        <HydrateClient>
          <StudioView />
        </HydrateClient>
    );
};

export default Page;