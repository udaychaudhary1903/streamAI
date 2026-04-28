import { DEFAULT_LIMIT } from "@/src/constants";
import { HydrateClient, trpc } from "@/src/trpc/server";
import { UserView } from "@/src/modules/users/ui/views/user-view";

interface PageProps {
  params: Promise<{
    userId: string;
  }>;
}

const Page = async ({ params }: PageProps) => {
  const { userId } = await params;

  void trpc.users.getOne.prefetch({ id: userId });
  void trpc.videos.getMany.prefetchInfinite({ userId, limit: DEFAULT_LIMIT });
  
  return ( 
    <HydrateClient>
      <UserView userId={userId} />
    </HydrateClient>
  );
};
 
export default Page;