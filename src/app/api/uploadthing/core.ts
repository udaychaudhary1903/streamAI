import { db } from "@/src/db";
import { users, videos, livestreams } from "@/src/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";
import z from "zod";

const f = createUploadthing();

export const ourFileRouter = {
    // --- Your existing video thumbnail uploader (unchanged) ---
    thumbnailUploader: f({
        image: { maxFileSize: "4MB", maxFileCount: 1 },
    })
        .input(z.object({ videoId: z.string().uuid() }))
        .middleware(async ({ input }) => {
            const { userId: clerkUserId } = await auth();
            if (!clerkUserId) throw new UploadThingError("Unauthorized");

            const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
            if (!user) throw new UploadThingError("Unauthorized");

            const [existingVideo] = await db
                .select({ thumbnailKey: videos.thumbnailKey })
                .from(videos)
                .where(and(eq(videos.id, input.videoId), eq(videos.userId, user.id)));

            if (!existingVideo) throw new UploadThingError("Not found");

            if (existingVideo.thumbnailKey) {
                const utapi = new UTApi();
                await utapi.deleteFiles(existingVideo.thumbnailKey);
                await db.update(videos)
                    .set({ thumbnailKey: null, thumbnailUrl: null })
                    .where(and(eq(videos.id, input.videoId), eq(videos.userId, user.id)));
            }

            return { user, ...input };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            await db.update(videos)
                .set({ thumbnailUrl: file.ufsUrl, thumbnailKey: file.key })
                .where(and(eq(videos.id, metadata.videoId), eq(videos.userId, metadata.user.id)));
            return { uploadedBy: metadata.user.id };
        }),

    // --- NEW: Livestream thumbnail uploader ---
    livestreamThumbnailUploader: f({
        image: { maxFileSize: "4MB", maxFileCount: 1 },
    })
        .input(z.object({ livestreamId: z.string().uuid() }))
        .middleware(async ({ input }) => {
            const { userId: clerkUserId } = await auth();
            if (!clerkUserId) throw new UploadThingError("Unauthorized");

            const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
            if (!user) throw new UploadThingError("Unauthorized");

            const [existingStream] = await db
                .select({ thumbnailUrl: livestreams.thumbnailUrl })
                .from(livestreams)
                .where(and(
                    eq(livestreams.id, input.livestreamId),
                    eq(livestreams.userId, user.id),
                ));

            if (!existingStream) throw new UploadThingError("Not found");

            return { user, ...input };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            await db.update(livestreams)
                .set({ thumbnailUrl: file.ufsUrl, updatedAt: new Date() })
                .where(and(
                    eq(livestreams.id, metadata.livestreamId),
                    eq(livestreams.userId, metadata.user.id),
                ));
            return { uploadedBy: metadata.user.id };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;