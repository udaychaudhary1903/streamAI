"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { trpc } from "@/src/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Radio } from "lucide-react";

const schema = z.object({
    title: z.string().min(1, "Title is required").max(100),
    description: z.string().optional(),
    visibility: z.enum(["public", "private"]).default("public"),
});

type FormValues = z.infer<typeof schema>;

export default function NewLivestreamPage() {
    const router = useRouter();

    const { register, handleSubmit, formState: { errors, isSubmitting } } =
        useForm<FormValues>({ resolver: zodResolver(schema) });

    const createMutation = trpc.livestreams.create.useMutation({
        onSuccess: (stream) => {
            toast.success("Stream created! Copy your stream key below.");
            router.push(`/studio/livestreams/${stream.id}`);
        },
        onError: () => toast.error("Failed to create stream"),
    });

    const onSubmit = (data: FormValues) => createMutation.mutate(data);

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                    <Radio className="h-5 w-5 text-red-500" />
                </div>
                <div>
                    <h1 className="text-xl font-bold">Go Live</h1>
                    <p className="text-sm text-muted-foreground">
                        Set up your live stream details
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Title *</label>
                    <Input
                        {...register("title")}
                        placeholder="What are you streaming today?"
                    />
                    {errors.title && (
                        <p className="text-xs text-red-500">{errors.title.message}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                        {...register("description")}
                        placeholder="Tell viewers what to expect..."
                        rows={3}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Visibility</label>
                    <select
                        {...register("visibility")}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                    </select>
                </div>

                <Button
                    type="submit"
                    className="w-full bg-red-500 hover:bg-red-600 text-white"
                    disabled={isSubmitting || createMutation.isPending}
                >
                    {createMutation.isPending ? "Creating..." : "Create & Get Stream Key"}
                </Button>
            </form>
        </div>
    );
}