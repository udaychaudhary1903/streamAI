import { VideoView } from "@/src/modules/studio/ui/views/video-view";
import { HydrateClient, trpc } from "@/src/trpc/server";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ videoId: string }>;
}

const Page = async ({ params }: PageProps) => {
    const { videoId } = await params;

    void trpc.studio.getOne.prefetch({ id: videoId });
    void trpc.categories.getMany.prefetch();

    return (
        <HydrateClient>
            <VideoView videoId={videoId} />
        </HydrateClient>
    );
};

export default Page;