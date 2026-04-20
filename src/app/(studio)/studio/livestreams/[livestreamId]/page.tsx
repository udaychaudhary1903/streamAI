"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/src/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Radio, Square, Eye } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";

export default function StudioLivestreamPage() {
    const { livestreamId } = useParams<{ livestreamId: string }>();
    const router = useRouter();
    const [isCopied, setIsCopied] = useState<"key" | "url" | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const utils = trpc.useUtils();

    const { data: stream, isLoading } = trpc.livestreams.getOne.useQuery(
        { id: livestreamId },
        { refetchInterval: 5000 }, // poll every 5s to detect when Mux goes active
    );

    const endMutation = trpc.livestreams.end.useMutation({
        onSuccess: () => {
            toast.success("Stream ended");
            utils.livestreams.getOne.invalidate({ id: livestreamId });
        },
        onError: () => toast.error("Failed to end stream"),
    });

    const deleteMutation = trpc.livestreams.delete.useMutation({
        onSuccess: () => {
            toast.success("Stream deleted");
            router.push("/studio/livestreams");
        },
    });

    const copyToClipboard = (text: string, type: "key" | "url") => {
        navigator.clipboard.writeText(text);
        setIsCopied(type);
        setTimeout(() => setIsCopied(null), 2000);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!stream) return <div className="p-6">Stream not found.</div>;

    const rtmpUrl = "rtmps://global-live.mux.com:443/app";
    const isActive = stream.isLive;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{stream.title}</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {stream.description ?? "No description set"}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {isActive ? (
                        <Badge className="bg-red-500 text-white animate-pulse flex items-center gap-1.5">
                            <Radio className="h-3 w-3" />
                            LIVE
                        </Badge>
                    ) : (
                        <Badge variant="secondary">
                            {stream.status === "ended" ? "Ended" : "Not Started"}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Stream Setup — OBS Instructions */}
            {stream.status !== "ended" && (
                <div className="rounded-xl border bg-card p-5 space-y-4">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <Radio className="h-4 w-4 text-red-500" />
                        Stream Setup (OBS / Streamlabs)
                    </h2>

                    {/* RTMP URL */}
                    <div className="space-y-1">
                        <label className="text-sm text-muted-foreground font-medium">
                            Server URL
                        </label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono truncate">
                                {rtmpUrl}
                            </code>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(rtmpUrl, "url")}
                            >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                {isCopied === "url" ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                    </div>

                    {/* Stream Key */}
                    <div className="space-y-1">
                        <label className="text-sm text-muted-foreground font-medium">
                            Stream Key <span className="text-red-400">(keep private)</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono truncate">
                                {stream.muxStreamKey ?? "Loading..."}
                            </code>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    copyToClipboard(stream.muxStreamKey ?? "", "key")
                                }
                            >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                {isCopied === "key" ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        In OBS: Settings → Stream → Service: Custom → paste Server URL and
                        Stream Key above. Then click &quot;Start Streaming&quot; in OBS.
                        Your stream will go live automatically.
                    </p>
                </div>
            )}

            {/* Live Preview Player */}
            {isActive && stream.muxPlaybackId && (
                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="px-5 py-3 border-b flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span className="font-medium">Live Preview (Viewer POV)</span>
                    </div>
                    <div className="aspect-video">
                        <MuxPlayer
                            streamType="live"
                            playbackId={stream.muxPlaybackId}
                            autoPlay
                            muted
                            style={{ width: "100%", height: "100%" }}
                        />
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                {isActive && (
                    <Button
                        variant="destructive"
                        onClick={() => endMutation.mutate({ id: stream.id })}
                        disabled={endMutation.isPending}
                        className="flex items-center gap-2"
                    >
                        <Square className="h-4 w-4" />
                        {endMutation.isPending ? "Ending..." : "End Stream"}
                    </Button>
                )}

                {stream.status === "ended" && (
                    <Button
                        variant="outline"
                        onClick={() => deleteMutation.mutate({ id: stream.id })}
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending ? "Deleting..." : "Delete Stream"}
                    </Button>
                )}

                <Button
                    variant="outline"
                    onClick={() => router.push(`/livestreams/${stream.id}`)}
                >
                    View Public Page
                </Button>
            </div>
        </div>
    );
}