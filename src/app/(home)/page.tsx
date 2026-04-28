import { DEFAULT_LIMIT } from "@/src/constants";
import { HomeView } from "@/src/modules/home/ui/views/home-view";
import { HydrateClient, trpc } from "@/src/trpc/server";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    categoryId?: string;
  }>;
};

const Page = async ({ searchParams }: PageProps) => {
  const { categoryId } = await searchParams;

  void trpc.categories.getMany.prefetch();
  void trpc.videos.getMany.prefetchInfinite({ categoryId, limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
        <HomeView categoryId={categoryId} />
    </HydrateClient>
  );
};

export default Page;