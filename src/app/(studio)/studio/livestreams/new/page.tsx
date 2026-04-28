// src/app/(studio)/studio/livestreams/new/page.tsx

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
import { RadioIcon } from "lucide-react";
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
import { Globe2Icon, LockIcon } from "lucide-react";

const schema = z.object({
    title: z.string().min(1, "Title is required").max(100),
    description: z.string().optional(),
    visibility: z.enum(["public", "private"]).default("public"),
});

type FormValues = z.infer<typeof schema>;

export default function NewLivestreamPage() {
    const router = useRouter();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            title: "",
            description: "",
            visibility: "public",
        },
    });

    const createMutation = trpc.livestreams.create.useMutation({
        onSuccess: (stream) => {
            toast.success("Stream created! Copy your stream key below.");
            router.push(`/studio/livestreams/${stream.id}`);
        },
        onError: () => toast.error("Failed to create stream. Please try again."),
    });

    const onSubmit = (data: FormValues) => createMutation.mutate(data);

    return (
        <div className="px-4 pt-2.5 max-w-screen-lg">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-red-100">
                    <RadioIcon className="h-5 w-5 text-red-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Go Live</h1>
                    <p className="text-xs text-muted-foreground">
                        Set up your live stream details
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Title *</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        placeholder="What are you streaming today?"
                                    />
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
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                    <Textarea
                                        {...field}
                                        placeholder="Tell viewers what to expect..."
                                        rows={4}
                                        className="resize-none"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="visibility"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Visibility</FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select visibility" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="public">
                                            <div className="flex items-center">
                                                <Globe2Icon className="size-4 mr-2" />
                                                Public
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="private">
                                            <div className="flex items-center">
                                                <LockIcon className="size-4 mr-2" />
                                                Private
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending
                            ? "Creating stream..."
                            : "Create Stream & Get Key"}
                    </Button>
                </form>
            </Form>
        </div>
    );
}