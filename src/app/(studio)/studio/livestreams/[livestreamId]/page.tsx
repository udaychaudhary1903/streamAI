"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/src/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, RadioIcon, Square, Eye, Globe2Icon, LockIcon, ImageIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "@/components/responsive-modal";
import { UploadDropzone } from "@/lib/uploadthing";

const formSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    visibility: z.enum(["public", "private"]),
});

type FormValues = z.infer<typeof formSchema>;

export default function StudioLivestreamPage() {
    const { livestreamId } = useParams<{ livestreamId: string }>();
    const router = useRouter();
    const [isCopied, setIsCopied] = useState<"key" | "url" | null>(null);
    const [thumbnailModalOpen, setThumbnailModalOpen] = useState(false);

    const utils = trpc.useUtils();

    const { data: stream, isLoading } = trpc.livestreams.getOne.useQuery(
        { id: livestreamId },
        { refetchInterval: 5000 },
    );

    const { data: categories } = trpc.categories.getMany.useQuery();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        values: {
            title: stream?.title ?? "",
            description: stream?.description ?? "",
            categoryId: stream?.categoryId ?? undefined,
            visibility: (stream?.visibility as "public" | "private") ?? "public",
        },
    });

    const updateMutation = trpc.livestreams.update.useMutation({
        onSuccess: () => {
            toast.success("Stream updated");
            utils.livestreams.getOne.invalidate({ id: livestreamId });
        },
        onError: () => toast.error("Failed to update stream"),
    });

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
            router.push("/studio");
        },
    });

    const generateTitleMutation = trpc.livestreams.generateTitle.useMutation({
        onSuccess: (title) => {
            form.setValue("title", title);
            toast.success("Title generated!");
        },
        onError: () => toast.error("Failed to generate title"),
    });

    const copyToClipboard = (text: string, type: "key" | "url") => {
        navigator.clipboard.writeText(text);
        setIsCopied(type);
        setTimeout(() => setIsCopied(null), 2000);
    };

    const onSubmit = (data: FormValues) => {
        updateMutation.mutate({ id: livestreamId, ...data });
    };

    if (isLoading) {
        return (
            <div className="px-4 pt-2.5 max-w-screen-lg space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    if (!stream) {
        return (
            <div className="px-4 pt-2.5">
                <p className="text-muted-foreground">Stream not found.</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push("/studio")}>
                    Back to Studio
                </Button>
            </div>
        );
    }

    const rtmpUrl = "rtmps://global-live.mux.com:443/app";
    const isActive = stream.isLive;

    return (
        <div className="px-4 pt-2.5 max-w-screen-lg pb-10 space-y-6">

            {/* Thumbnail upload modal */}
            <ResponsiveModal
                title="Upload thumbnail"
                open={thumbnailModalOpen}
                onOpenChange={setThumbnailModalOpen}
            >
                <UploadDropzone
                    endpoint="livestreamThumbnailUploader"
                    input={{ livestreamId }}
                    onClientUploadComplete={() => {
                        utils.livestreams.getOne.invalidate({ id: livestreamId });
                        setThumbnailModalOpen(false);
                        toast.success("Thumbnail updated!");
                    }}
                />
            </ResponsiveModal>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{stream.title}</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        {stream.description ?? "No description set"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isActive ? (
                        <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full animate-pulse">
                            <RadioIcon className="h-3 w-3" />
                            LIVE
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-muted text-muted-foreground text-xs font-medium px-3 py-1.5 rounded-full">
                            {stream.status === "ended" ? "Ended" : "Not started"}
                        </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {stream.visibility === "public"
                            ? <Globe2Icon className="size-3.5" />
                            : <LockIcon className="size-3.5" />}
                        {stream.visibility}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Left column: OBS setup + player */}
                <div className="lg:col-span-3 space-y-4">

                    {/* OBS Setup */}
                    {stream.status !== "ended" && (
                        <div className="rounded-xl border bg-[#F9F9F9] p-5 space-y-4">
                            <h2 className="font-semibold flex items-center gap-2">
                                <RadioIcon className="h-4 w-4 text-red-500" />
                                Stream setup (OBS / Streamlabs)
                            </h2>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Server URL
                                </label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 rounded-md bg-white border px-3 py-2 text-sm font-mono truncate">
                                        {rtmpUrl}
                                    </code>
                                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(rtmpUrl, "url")}>
                                        <Copy className="h-3.5 w-3.5 mr-1" />
                                        {isCopied === "url" ? "Copied!" : "Copy"}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Stream key <span className="text-red-400 normal-case">(keep private)</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 rounded-md bg-white border px-3 py-2 text-sm font-mono truncate">
                                        {stream.muxStreamKey ?? "Generating..."}
                                    </code>
                                    <Button size="sm" variant="outline"
                                        onClick={() => copyToClipboard(stream.muxStreamKey ?? "", "key")}
                                        disabled={!stream.muxStreamKey}
                                    >
                                        <Copy className="h-3.5 w-3.5 mr-1" />
                                        {isCopied === "key" ? "Copied!" : "Copy"}
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 space-y-1">
                                <p className="font-semibold">How to go live with OBS:</p>
                                <ol className="list-decimal list-inside space-y-0.5">
                                    <li>Open OBS → Settings → Stream → Service: Custom</li>
                                    <li>Paste Server URL and Stream Key above</li>
                                    <li>Click Start Streaming in OBS</li>
                                    <li>This page auto-updates when you go live ✓</li>
                                </ol>
                            </div>
                        </div>
                    )}

                    {/* Live preview */}
                    {isActive && stream.muxPlaybackId && (
                        <div className="rounded-xl border overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center gap-2 bg-white">
                                <Eye className="h-4 w-4" />
                                <span className="font-medium text-sm">Live preview (viewer POV)</span>
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

                    {/* Waiting state */}
                    {!isActive && stream.status === "idle" && (
                        <div className="rounded-xl border bg-[#F9F9F9] aspect-video flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <RadioIcon className="h-12 w-12 opacity-20" />
                            <p className="text-sm">Waiting for stream to start...</p>
                            <p className="text-xs">Connect OBS using the settings above</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {isActive && (
                            <Button variant="destructive"
                                onClick={() => endMutation.mutate({ id: stream.id })}
                                disabled={endMutation.isPending}
                                className="gap-2"
                            >
                                <Square className="h-4 w-4" />
                                {endMutation.isPending ? "Ending..." : "End stream"}
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => router.push(`/livestreams/${stream.id}`)}>
                            View public page
                        </Button>
                        {stream.status === "ended" && (
                            <Button variant="outline"
                                className="text-red-500 hover:text-red-600 border-red-200"
                                onClick={() => deleteMutation.mutate({ id: stream.id })}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? "Deleting..." : "Delete stream"}
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => router.push("/studio")}>
                            Back to studio
                        </Button>
                    </div>
                </div>

                {/* Right column: edit form + thumbnail */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Thumbnail */}
                    <div className="rounded-xl border bg-[#F9F9F9] overflow-hidden">
                        <div className="aspect-video relative bg-muted">
                            {stream.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={stream.thumbnailUrl}
                                    alt="Thumbnail"
                                    className="w-full h-full object-cover"
                                />
                            ) : stream.muxPlaybackId ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={`https://image.mux.com/${stream.muxPlaybackId}/thumbnail.jpg`}
                                    alt="Auto thumbnail"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <ImageIcon className="h-10 w-10 opacity-30" />
                                </div>
                            )}
                        </div>
                        <div className="p-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-2"
                                onClick={() => setThumbnailModalOpen(true)}
                            >
                                <ImageIcon className="h-4 w-4" />
                                Change thumbnail
                            </Button>
                        </div>
                    </div>

                    {/* Edit form */}
                    <div className="rounded-xl border bg-[#F9F9F9] p-4">
                        <h3 className="font-semibold mb-4 text-sm">Stream details</h3>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center justify-between">
                                                <FormLabel className="text-xs">Title</FormLabel>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-xs gap-1 text-blue-600"
                                                    onClick={() => generateTitleMutation.mutate({ id: livestreamId })}
                                                    disabled={generateTitleMutation.isPending}
                                                >
                                                    {generateTitleMutation.isPending
                                                        ? <Loader2Icon className="h-3 w-3 animate-spin" />
                                                        : <SparklesIcon className="h-3 w-3" />}
                                                    AI generate
                                                </Button>
                                            </div>
                                            <FormControl>
                                                <Input {...field} placeholder="Stream title" className="bg-white" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Description</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    rows={3}
                                                    placeholder="Tell viewers what to expect..."
                                                    className="resize-none bg-white"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="categoryId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Category</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {categories?.map((cat) => (
                                                        <SelectItem key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="visibility"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Visibility</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="public">
                                                        <div className="flex items-center gap-2">
                                                            <Globe2Icon className="size-4" /> Public
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="private">
                                                        <div className="flex items-center gap-2">
                                                            <LockIcon className="size-4" /> Private
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? (
                                        <><Loader2Icon className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                                    ) : "Save changes"}
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
    );
}