import { HydrateClient, trpc } from "@/src/trpc/server";

import { DEFAULT_LIMIT } from "@/src/constants";
import { SearchView } from "@/src/modules/search/ui/views/search-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    query: string | undefined;
    categoryId: string | undefined;
  }>
}

const Page = async ({ searchParams }: PageProps) => {
  const { query, categoryId } = await searchParams;

  void trpc.categories.getMany.prefetch();
  void trpc.search.getMany.prefetchInfinite({
    query,
    categoryId,
    limit: DEFAULT_LIMIT,
  });

  return ( 
    <HydrateClient>
      <SearchView query={query} categoryId={categoryId} />
    </HydrateClient>
  );
}
 
export default Page;
