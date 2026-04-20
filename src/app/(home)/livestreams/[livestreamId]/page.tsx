"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/src/trpc/client";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Radio, UserCircle } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import { formatDistanceToNow } from "date-fns";

export default function LivestreamViewerPage() {
    const { livestreamId } = useParams<{ livestreamId: string }>();
    const { user, isSignedIn } = useUser();
    const [message, setMessage] = useState("");
    const chatBottomRef = useRef<HTMLDivElement>(null);

    const { data: stream } = trpc.livestreams.getOne.useQuery(
        { id: livestreamId },
        { refetchInterval: 10000 },
    );

    const { data: chatData, refetch: refetchChat } = trpc.livestreams.getChatMessages.useQuery(
        { livestreamId, limit: 100 },
        { refetchInterval: 3000 }, // poll chat every 3s
    );

    const sendMessageMutation = trpc.livestreams.sendChatMessage.useMutation({
        onSuccess: () => {
            setMessage("");
            refetchChat();
            setTimeout(() => {
                chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        },
        onError: (err) => toast.error(err.message),
    });

    // Auto-scroll chat on new messages
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatData]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !isSignedIn) return;
        sendMessageMutation.mutate({ livestreamId, message: message.trim() });
    };

    const messages = [...(chatData ?? [])].reverse(); // newest at bottom

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
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-white gap-3">
                                <Radio className="h-12 w-12 opacity-30" />
                                <p className="text-lg opacity-50">
                                    {stream?.status === "ended"
                                        ? "This stream has ended."
                                        : "Stream hasn't started yet."}
                                </p>
                            </div>
                        )}

                        {/* LIVE badge overlay */}
                        {stream?.isLive && (
                            <div className="absolute top-3 left-3">
                                <Badge className="bg-red-500 text-white animate-pulse flex items-center gap-1.5 px-2.5 py-1">
                                    <span className="h-2 w-2 rounded-full bg-white inline-block" />
                                    LIVE
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Stream Info */}
                    {stream && (
                        <div className="space-y-3">
                            <h1 className="text-xl font-bold">{stream.title}</h1>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={stream.user?.imageUrl} />
                                    <AvatarFallback>
                                        {stream.user?.name?.[0]?.toUpperCase() ?? "U"}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-sm">{stream.user?.name}</p>
                                    {stream.category && (
                                        <p className="text-xs text-muted-foreground">
                                            {stream.category.name}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {stream.description && (
                                <p className="text-sm text-muted-foreground">
                                    {stream.description}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Live Chat */}
                <div className="w-full lg:w-80 xl:w-96 flex flex-col rounded-xl border bg-card overflow-hidden h-[600px]">

                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b flex items-center gap-2">
                        <span className="font-semibold text-sm">Live Chat</span>
                        {stream?.isLive && (
                            <Badge variant="secondary" className="text-xs">
                                Live
                            </Badge>
                        )}
                    </div>

                    {/* Messages */}
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
                                        <span className="font-semibold text-xs">
                                            {msg.user?.name ?? "Anonymous"}
                                        </span>
                                        <span className="text-muted-foreground text-[10px] ml-1.5">
                                            {formatDistanceToNow(new Date(msg.createdAt), {
                                                addSuffix: true,
                                            })}
                                        </span>
                                        <p className="text-sm break-words">{msg.message}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatBottomRef} />
                        </div>
                    </ScrollArea>

                    {/* Chat Input */}
                    <div className="p-3 border-t">
                        {isSignedIn ? (
                            <form onSubmit={handleSend} className="flex gap-2">
                                <Input
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Say something..."
                                    maxLength={500}
                                    className="flex-1 text-sm"
                                    disabled={sendMessageMutation.isPending}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={!message.trim() || sendMessageMutation.isPending}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        ) : (
                            <p className="text-center text-sm text-muted-foreground">
                                <a href="/sign-in" className="underline hover:text-foreground">
                                    Sign in
                                </a>{" "}
                                to join the chat
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}