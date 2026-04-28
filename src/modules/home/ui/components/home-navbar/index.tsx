"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image";
import { SearchInput } from "./search-input";
import { AuthButton } from "@/src/modules/auth/ui/components/auth-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusIcon, UploadIcon, RadioIcon } from "lucide-react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { trpc } from "@/src/trpc/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ResponsiveModal } from "@/components/responsive-modal";
import { StudioUploader } from "@/src/modules/studio/ui/components/studio-uploader";
import { Loader2Icon } from "lucide-react";

export const HomeNavbar = () => {
    const { isSignedIn } = useAuth();
    const clerk = useClerk();
    const router = useRouter();

    const utils = trpc.useUtils();
    const create = trpc.videos.create.useMutation({
        onSuccess: () => {
            toast.success("Video created!");
            utils.studio.getMany.invalidate();
        },
        onError: () => toast.error("Something went wrong"),
    });

    const onSuccess = () => {
        if (!create.data?.video.id) return;
        create.reset();
        router.push(`/studio/videos/${create.data.video.id}`);
    };

    const handleCreateClick = (type: "video" | "live") => {
        if (!isSignedIn) {
            clerk.openSignIn();
            return;
        }
        if (type === "video") {
            create.mutate();
        } else {
            router.push("/studio/livestreams/new");
        }
    };

    return (
        <>
            {/* Upload modal */}
            <ResponsiveModal
                title="Upload Video"
                open={!!create.data?.url}
                onOpenChange={() => create.reset()}
            >
                {create.data?.url ? (
                    <StudioUploader endpoint={create.data.url} onSuccess={onSuccess} />
                ) : (
                    <Loader2Icon className="animate-spin" />
                )}
            </ResponsiveModal>

            <nav className="fixed top-0 left-0 right-0 h-16 bg-white flex items-center px-2 pr-5 z-50">
                <div className="flex items-center gap-4 w-full">
                    {/* Menu and logo */}
                    <div className="flex items-center flex-shrink-0">
                        <SidebarTrigger />
                        <Link prefetch href="/" className="hidden md:block">
                            <div className="p-4 flex items-center gap-1">
                                <Image src="/main.png" alt="Logo" width={32} height={32} />
                                <p className="text-xl font-semibold tracking-tight">streamAI</p>
                            </div>
                        </Link>
                    </div>

                    {/* Search bar */}
                    <div className="flex-1 flex justify-center max-w-[720px] mx-auto">
                        <SearchInput />
                    </div>

                    {/* Right actions */}
                    <div className="flex-shrink-0 items-center flex gap-3">
                        {/* Create button */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="gap-1.5 rounded-full px-4"
                                    disabled={create.isPending}
                                >
                                    {create.isPending ? (
                                        <Loader2Icon className="size-4 animate-spin" />
                                    ) : (
                                        <PlusIcon className="size-4" />
                                    )}
                                    <span className="hidden sm:inline">Create</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                    onClick={() => handleCreateClick("video")}
                                    className="gap-2 cursor-pointer"
                                >
                                    <UploadIcon className="size-4" />
                                    Upload video
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleCreateClick("live")}
                                    className="gap-2 cursor-pointer"
                                >
                                    <RadioIcon className="size-4 text-red-500" />
                                    Go live
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <AuthButton />
                    </div>
                </div>
            </nav>
        </>
    );
};