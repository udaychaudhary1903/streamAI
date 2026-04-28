"use client";
 
import MuxPlayer from "@mux/mux-player-react";
import { THUMBNAIL_FALLBACK } from "../../constants";
import { trpc } from "@/src/trpc/client";
import { useRef } from "react";
 
interface VideoPlayerProps {
    playbackId?: string | null | undefined;
    thumbnailUrl?: string | null | undefined;
    autoPlay?: boolean;
    onPlay?: () => void;
    videoId?: string; // track views
};
 
export const VideoPlayerSkeleton = () => {
  return <div className="aspect-video bg-black rounded-xl" />;
};
 
export const VideoPlayer = ({
    playbackId,
    thumbnailUrl,
    autoPlay,
    onPlay,
    videoId,
}: VideoPlayerProps) => {
    const hasTracked = useRef(false);
 
    // View tracking mutation
    const createView = trpc.videoViews.create.useMutation();
 
    const handlePlay = () => {
        // Only track once per mount — not every resume
        if (videoId && !hasTracked.current) {
            hasTracked.current = true;
            createView.mutate({ videoId });
        }
        onPlay?.();
    };
 
    if (!playbackId) return null;
 
    return (
        <MuxPlayer
            playbackId={playbackId}
            poster={thumbnailUrl || THUMBNAIL_FALLBACK}
            playerInitTime={0}
            autoPlay={autoPlay}
            thumbnailTime={0}
            className="w-full h-full object-contain"
            accentColor="#FF2056"
            onPlay={handlePlay}
        />
    );
};
 