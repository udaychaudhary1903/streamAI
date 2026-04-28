"use client";

import Link from "next/link";
import { trpc } from "@/src/trpc/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RadioIcon } from "lucide-react";

interface LivestreamsSectionProps {
    categoryId?: string;
}

export const LivestreamsSection = ({ categoryId }: LivestreamsSectionProps) => {
    const { data } = trpc.livestreams.getMany.useQuery(
        { categoryId, limit: 8 },
        { refetchInterval: 15000 },
    );

    const streams = data?.items ?? [];
    if (streams.length === 0) return null;

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse inline-block" />
                <h2 className="font-semibold text-base">Live now</h2>
                <span className="bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                    {streams.length}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {streams.map((stream) => (
                    <LivestreamCard key={stream.id} stream={stream} />
                ))}
            </div>
        </section>
    );
};

function LivestreamCard({ stream }: {
    stream: {
        id: string;
        title: string;
        thumbnailUrl: string | null;
        muxPlaybackId: string | null;
        user: { name: string; imageUrl: string } | null;
        category: { name: string } | null;
    };
}) {
    const thumbnail =
        stream.thumbnailUrl ??
        (stream.muxPlaybackId
            ? `https://image.mux.com/${stream.muxPlaybackId}/thumbnail.jpg`
            : "/placeholder.svg");

    return (
        <Link href={`/livestreams/${stream.id}`} className="group">
            <div className="space-y-2">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={thumbnail}
                        alt={stream.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        <RadioIcon className="h-2.5 w-2.5" />
                        LIVE
                    </div>
                </div>

                <div className="flex gap-2 px-0.5">
                    <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                        <AvatarImage src={stream.user?.imageUrl} />
                        <AvatarFallback className="text-[10px]">
                            {stream.user?.name?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="font-medium text-sm leading-tight truncate">{stream.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{stream.user?.name}</p>
                        {stream.category && (
                            <p className="text-xs text-muted-foreground truncate">{stream.category.name}</p>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}