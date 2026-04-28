"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/src/trpc/client";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Send, RadioIcon, ThumbsUpIcon, ThumbsDownIcon } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import Link from "next/link";
import { useSubscription } from "@/src/modules/subscriptions/hooks/use-subscription";
import { SubscriptionButton } from "@/src/modules/subscriptions/ui/components/subscription-button";

export default function LivestreamViewerPage() {
    const { livestreamId } = useParams<{ livestreamId: string }>();
    const { userId: clerkUserId, isLoaded } = useAuth();
    const clerk = useClerk();
    const [message, setMessage] = useState("");
    const chatBottomRef = useRef<HTMLDivElement>(null);

    const utils = trpc.useUtils();

    const { data: stream } = trpc.livestreams.getOne.useQuery(
        { id: livestreamId },
        { refetchInterval: 10000 },
    );

    const { data: chatData, refetch: refetchChat } = trpc.livestreams.getChatMessages.useQuery(
        { livestreamId, limit: 100 },
        { refetchInterval: 3000 },
    );

    const likeMutation = trpc.livestreams.like.useMutation({
        onSuccess: () => utils.livestreams.getOne.invalidate({ id: livestreamId }),
        onError: (e) => {
            if (e.data?.code === "UNAUTHORIZED") clerk.openSignIn();
            else toast.error("Something went wrong");
        },
    });

    const dislikeMutation = trpc.livestreams.dislike.useMutation({
        onSuccess: () => utils.livestreams.getOne.invalidate({ id: livestreamId }),
        onError: (e) => {
            if (e.data?.code === "UNAUTHORIZED") clerk.openSignIn();
            else toast.error("Something went wrong");
        },
    });

    const sendMessageMutation = trpc.livestreams.sendChatMessage.useMutation({
        onSuccess: () => {
            setMessage("");
            refetchChat();
            setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        },
        onError: (err) => {
            if (err.data?.code === "UNAUTHORIZED") clerk.openSignIn();
            else toast.error(err.message);
        },
    });

    const { isPending: subPending, onClick: onSubscribeClick } = useSubscription({
        userId: stream?.user?.id ?? "",
        isSubscribed: stream?.viewerSubscribed ?? false,
        fromVideoId: undefined,
    });

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatData]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        if (!clerkUserId) { clerk.openSignIn(); return; }
        sendMessageMutation.mutate({ livestreamId, message: message.trim() });
    };

    const messages = [...(chatData ?? [])].reverse();

    const likeCount = Intl.NumberFormat("en", { notation: "compact" }).format(stream?.likeCount ?? 0);
    const dislikeCount = Intl.NumberFormat("en", { notation: "compact" }).format(stream?.dislikeCount ?? 0);
    const subscriberCount = Intl.NumberFormat("en", { notation: "compact" }).format(stream?.user?.subscriberCount ?? 0);

    return (
        <div className="max-w-[1400px] mx-auto px-4 py-6">
            <div className="flex flex-col lg:flex-row gap-6">

                {/* Left: Player + Info */}
                <div className="flex-1 min-w-0 space-y-4">

                    {/* Player */}
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                        {stream?.isLive && stream.muxPlaybackId ? (
                            <MuxPlayer
                                streamType="live"
                                playbackId={stream.muxPlaybackId}
                                autoPlay
                                style={{ width: "100%", height: "100%" }}
                                accentColor="#FF2056"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-white gap-3">
                                <RadioIcon className="h-12 w-12 opacity-20" />
                                <p className="text-sm opacity-50">
                                    {stream?.status === "ended"
                                        ? "This stream has ended."
                                        : "Stream hasn't started yet. Check back soon!"}
                                </p>
                            </div>
                        )}

                        {stream?.isLive && (
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-white inline-block" />
                                LIVE
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    {stream && (
                        <h1 className="text-xl font-semibold">{stream.title}</h1>
                    )}

                    {/* Owner row + reactions */}
                    {stream?.user && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                            {/* Owner info */}
                            <div className="flex items-center gap-3">
                                <Link href={`/users/${stream.user.id}`}>
                                    <UserAvatar
                                        size="lg"
                                        imageUrl={stream.user.imageUrl}
                                        name={stream.user.name}
                                    />
                                </Link>
                                <div className="flex flex-col min-w-0">
                                    <Link href={`/users/${stream.user.id}`}>
                                        <p className="font-semibold text-sm hover:underline">{stream.user.name}</p>
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        {subscriberCount} subscribers
                                    </p>
                                </div>
                                {/* Subscribe button — only for non-owners */}
                                {clerkUserId !== stream.user.clerkId && (
                                    <SubscriptionButton
                                        onClick={onSubscribeClick}
                                        disabled={subPending || !isLoaded}
                                        isSubscribed={stream.viewerSubscribed ?? false}
                                        className="flex-none"
                                    />
                                )}
                            </div>

                            {/* Like / Dislike */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center">
                                    <Button
                                        variant="secondary"
                                        className="rounded-l-full rounded-r-none gap-2 pr-4"
                                        disabled={likeMutation.isPending || dislikeMutation.isPending}
                                        onClick={() => likeMutation.mutate({ livestreamId })}
                                    >
                                        <ThumbsUpIcon className={cn(
                                            "size-5",
                                            stream?.viewerReaction === "like" && "fill-black"
                                        )} />
                                        {likeCount}
                                    </Button>
                                    <Separator orientation="vertical" className="h-7" />
                                    <Button
                                        variant="secondary"
                                        className="rounded-l-none rounded-r-full pl-3"
                                        disabled={likeMutation.isPending || dislikeMutation.isPending}
                                        onClick={() => dislikeMutation.mutate({ livestreamId })}
                                    >
                                        <ThumbsDownIcon className={cn(
                                            "size-5",
                                            stream?.viewerReaction === "dislike" && "fill-black"
                                        )} />
                                        {dislikeCount}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {stream?.description && (
                        <div className="bg-secondary/50 rounded-xl p-3">
                            <p className="text-sm whitespace-pre-wrap">{stream.description}</p>
                        </div>
                    )}
                </div>

                {/* Right: Live Chat */}
                <div className="w-full lg:w-80 xl:w-96 flex flex-col rounded-xl border bg-card overflow-hidden" style={{ height: "600px" }}>

                    <div className="px-4 py-3 border-b flex items-center gap-2">
                        <span className="font-semibold text-sm">Live chat</span>
                        {stream?.isLive && (
                            <span className="bg-red-100 text-red-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                Live
                            </span>
                        )}
                    </div>

                    <ScrollArea className="flex-1 px-3 py-2">
                        <div className="space-y-3">
                            {messages.length === 0 && (
                                <p className="text-center text-muted-foreground text-xs pt-8">
                                    No messages yet. Be the first to chat!
                                </p>
                            )}
                            {messages.map((msg) => (
                                <div key={msg.id} className="flex gap-2 items-start">
                                    <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                                        <AvatarImage src={msg.user?.imageUrl} />
                                        <AvatarFallback className="text-[10px]">
                                            {msg.user?.name?.[0]?.toUpperCase() ?? "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <span className="font-semibold text-xs">{msg.user?.name ?? "Anonymous"}</span>
                                        <span className="text-muted-foreground text-[10px] ml-1.5">
                                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                                        </span>
                                        <p className="text-sm break-words">{msg.message}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatBottomRef} />
                        </div>
                    </ScrollArea>

                    <div className="p-3 border-t">
                        {clerkUserId ? (
                            <form onSubmit={handleSend} className="flex gap-2">
                                <Input
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Say something..."
                                    maxLength={500}
                                    className="flex-1 text-sm"
                                    disabled={sendMessageMutation.isPending}
                                />
                                <Button type="submit" size="icon"
                                    disabled={!message.trim() || sendMessageMutation.isPending}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        ) : (
                            <p className="text-center text-sm text-muted-foreground">
                                <button onClick={() => clerk.openSignIn()} className="underline hover:text-foreground">
                                    Sign in
                                </button>{" "}to join the chat
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}