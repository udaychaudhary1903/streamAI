import { z } from "zod";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { db } from "@/src/db";
import {
    livestreams,
    liveChatMessages,
    users,
    subscriptions,
    videoReactions,
    livestreamReactions,
} from "@/src/db/schema";
import { mux } from "@/lib/mux";
import { workflow } from "@/lib/workflow";
import { createTRPCRouter, protectedProcedure, baseProcedure } from "@/src/trpc/init";
import { APP_URL } from "@/src/constants";
import { moderateText } from "@/lib/ai-client";

// ----------------------------------------------------------------
// Helper: get a single livestream with all viewer-specific data
// ----------------------------------------------------------------
const getLivestreamWithViewer = async (id: string, viewerUserId?: string) => {
    const [stream] = await db
        .select({
            ...getTableColumns(livestreams),
            user: {
                id: users.id,
                name: users.name,
                imageUrl: users.imageUrl,
                clerkId: users.clerkId,
                subscriberCount: db.$count(
                    subscriptions,
                    eq(subscriptions.creatorId, users.id)
                ),
                viewerSubscribed: viewerUserId
                    ? sql<boolean>`EXISTS (
                        SELECT 1 FROM subscriptions
                        WHERE subscriptions.viewer_id = ${viewerUserId}
                        AND subscriptions.creator_id = ${users.id}
                      )`.mapWith(Boolean)
                    : sql<boolean>`false`.mapWith(Boolean),
            },
            likeCount: db.$count(
                videoReactions,
                and(
                    eq(videoReactions.videoId, livestreams.id),
                    eq(videoReactions.type, "like")
                )
            ),
            dislikeCount: db.$count(
                videoReactions,
                and(
                    eq(videoReactions.videoId, livestreams.id),
                    eq(videoReactions.type, "dislike")
                )
            ),
            viewerReaction: viewerUserId
                ? sql<"like" | "dislike" | null>`(
                    SELECT type FROM video_reactions
                    WHERE video_id = ${livestreams.id}
                    AND user_id = ${viewerUserId}
                    LIMIT 1
                  )`.mapWith(String)
                : sql<null>`null`,
        })
        .from(livestreams)
        .innerJoin(users, eq(livestreams.userId, users.id))
        .where(eq(livestreams.id, id))
        .limit(1);

    return stream ?? null;
};

export const livestreamsRouter = createTRPCRouter({

    // ----------------------------------------------------------------
    // CREATE
    // ----------------------------------------------------------------
    create: protectedProcedure
        .input(z.object({
            title: z.string().min(1).max(100),
            description: z.string().optional(),
            categoryId: z.string().uuid().optional(),
            visibility: z.enum(["public", "private"]).default("public"),
        }))
        .mutation(async ({ ctx, input }) => {
            const { id: userId } = ctx.user;

            const muxStream = await mux.video.liveStreams.create({
                playback_policy: ["public"],
                new_asset_settings: { playback_policy: ["public"] },
                latency_mode: "low",
                reconnect_window: 60,
            });

            const playbackId = muxStream.playback_ids?.[0]?.id;

            const [livestream] = await db
                .insert(livestreams)
                .values({
                    userId,
                    title: input.title,
                    description: input.description,
                    categoryId: input.categoryId,
                    visibility: input.visibility,
                    muxStreamId: muxStream.id,
                    muxStreamKey: muxStream.stream_key,
                    muxPlaybackId: playbackId,
                    status: "idle",
                    isLive: false,
                })
                .returning();

            return livestream;
        }),

    // ----------------------------------------------------------------
    // GET ONE (with viewer reaction + subscription data)
    // ----------------------------------------------------------------
    getOne: baseProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            const viewerUserId = (ctx as { user?: { id: string } }).user?.id;
            const stream = await getLivestreamWithViewer(input.id, viewerUserId);
            if (!stream) throw new TRPCError({ code: "NOT_FOUND" });
            return stream;
        }),

    // ----------------------------------------------------------------
    // GET MANY (homepage Live Now section)
    // ----------------------------------------------------------------
    getMany: baseProcedure
        .input(z.object({
            categoryId: z.string().uuid().optional(),
            limit: z.number().min(1).max(50).default(20),
        }))
        .query(async ({ input }) => {
            const data = await db.query.livestreams.findMany({
                where: and(
                    eq(livestreams.isLive, true),
                    eq(livestreams.visibility, "public"),
                    input.categoryId
                        ? eq(livestreams.categoryId, input.categoryId)
                        : undefined,
                ),
                with: {
                    user: { columns: { id: true, name: true, imageUrl: true } },
                    category: { columns: { id: true, name: true } },
                },
                orderBy: [desc(livestreams.startedAt)],
                limit: input.limit,
            });

            return { items: data };
        }),

    // ----------------------------------------------------------------
    // UPDATE
    // ----------------------------------------------------------------
    update: protectedProcedure
        .input(z.object({
            id: z.string().uuid(),
            title: z.string().min(1).max(100).optional(),
            description: z.string().optional(),
            categoryId: z.string().uuid().nullish(),
            visibility: z.enum(["public", "private"]).optional(),
            thumbnailUrl: z.string().url().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { id: userId } = ctx.user;
            const { id, ...data } = input;

            const [updated] = await db
                .update(livestreams)
                .set({ ...data, updatedAt: new Date() })
                .where(and(eq(livestreams.id, id), eq(livestreams.userId, userId)))
                .returning();

            if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
            return updated;
        }),

    // ----------------------------------------------------------------
    // END
    // ----------------------------------------------------------------
    end: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { id: userId } = ctx.user;

            const stream = await db.query.livestreams.findFirst({
                where: and(eq(livestreams.id, input.id), eq(livestreams.userId, userId)),
            });
            if (!stream) throw new TRPCError({ code: "NOT_FOUND" });

            if (stream.muxStreamId) {
                await mux.video.liveStreams.disable(stream.muxStreamId);
            }

            const [updated] = await db
                .update(livestreams)
                .set({ status: "ended", isLive: false, endedAt: new Date(), updatedAt: new Date() })
                .where(eq(livestreams.id, input.id))
                .returning();

            return updated;
        }),

    // ----------------------------------------------------------------
    // DELETE
    // ----------------------------------------------------------------
    delete: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { id: userId } = ctx.user;

            const stream = await db.query.livestreams.findFirst({
                where: and(eq(livestreams.id, input.id), eq(livestreams.userId, userId)),
            });
            if (!stream) throw new TRPCError({ code: "NOT_FOUND" });

            if (stream.muxStreamId) {
                await mux.video.liveStreams.delete(stream.muxStreamId).catch(() => null);
            }

            await db.delete(livestreams).where(eq(livestreams.id, input.id));
            return { success: true };
        }),

    // ----------------------------------------------------------------
    // LIKE
    // ----------------------------------------------------------------
     like: protectedProcedure
        .input(z.object({ livestreamId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { id: userId } = ctx.user;
 
            const existing = await db.query.livestreamReactions.findFirst({
                where: and(
                    eq(livestreamReactions.livestreamId, input.livestreamId),
                    eq(livestreamReactions.userId, userId),
                ),
            });
 
            if (existing?.type === "like") {
                // Toggle off — remove like
                await db.delete(livestreamReactions).where(
                    and(
                        eq(livestreamReactions.livestreamId, input.livestreamId),
                        eq(livestreamReactions.userId, userId),
                    )
                );
                return { reaction: null };
            }
 
            // Insert or switch to like
            await db
                .insert(livestreamReactions)
                .values({ livestreamId: input.livestreamId, userId, type: "like" })
                .onConflictDoUpdate({
                    target: [livestreamReactions.livestreamId, livestreamReactions.userId],
                    set: { type: "like", updatedAt: new Date() },
                });
 
            return { reaction: "like" };
        }),
 
    dislike: protectedProcedure
        .input(z.object({ livestreamId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { id: userId } = ctx.user;
 
            const existing = await db.query.livestreamReactions.findFirst({
                where: and(
                    eq(livestreamReactions.livestreamId, input.livestreamId),
                    eq(livestreamReactions.userId, userId),
                ),
            });
 
            if (existing?.type === "dislike") {
                await db.delete(livestreamReactions).where(
                    and(
                        eq(livestreamReactions.livestreamId, input.livestreamId),
                        eq(livestreamReactions.userId, userId),
                    )
                );
                return { reaction: null };
            }
 
            await db
                .insert(livestreamReactions)
                .values({ livestreamId: input.livestreamId, userId, type: "dislike" })
                .onConflictDoUpdate({
                    target: [livestreamReactions.livestreamId, livestreamReactions.userId],
                    set: { type: "dislike", updatedAt: new Date() },
                });
 
            return { reaction: "dislike" };
        }),

    // ----------------------------------------------------------------
    // AI: Generate title using Groq (same pattern as your video title)
    // ----------------------------------------------------------------
    generateTitle: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { id: userId } = ctx.user;

            const stream = await db.query.livestreams.findFirst({
                where: and(eq(livestreams.id, input.id), eq(livestreams.userId, userId)),
            });
            if (!stream) throw new TRPCError({ code: "NOT_FOUND" });

            // Use Groq to generate a catchy title based on the description
            const prompt = stream.description
                ? `Generate a short, catchy live stream title (max 60 chars) for this stream: "${stream.description}". Return ONLY the title, no quotes.`
                : "Generate a short, catchy live stream title (max 60 chars). Return ONLY the title, no quotes.";

            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "user", content: prompt }],
                }),
            });

            if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            const data = await res.json();
            const title = data.choices?.[0]?.message?.content?.trim();

            if (!title) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            await db.update(livestreams)
                .set({ title, updatedAt: new Date() })
                .where(eq(livestreams.id, input.id));

            return title;
        }),

    // ----------------------------------------------------------------
    // SEND CHAT MESSAGE (with AI moderation)
    // ----------------------------------------------------------------
    sendChatMessage: protectedProcedure
        .input(z.object({
            livestreamId: z.string().uuid(),
            message: z.string().min(1).max(500),
        }))
        .mutation(async ({ ctx, input }) => {
            const user = ctx.user;
 
            // Call Python AI service for moderation (2 layers: profanity + OpenAI)
            const modResult = await moderateText(input.message);
 
            if (modResult.flagged) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: modResult.reason === "profanity"
                        ? "Your message contains inappropriate language."
                        : "Your message was flagged by our content moderation system.",
                });
            }
 
            // Save clean message
            const [msg] = await db
                .insert(liveChatMessages)
                .values({
                    livestreamId: input.livestreamId,
                    userId: user.id,
                    message: input.message,
                    isFlagged: false,
                })
                .returning();
 
            return { ...msg, user: { name: user.name, imageUrl: user.imageUrl } };
        }),

    // ----------------------------------------------------------------
    // GET CHAT MESSAGES
    // ----------------------------------------------------------------
    getChatMessages: baseProcedure
        .input(z.object({
            livestreamId: z.string().uuid(),
            limit: z.number().default(50),
        }))
        .query(async ({ input }) => {
            return db.query.liveChatMessages.findMany({
                where: and(
                    eq(liveChatMessages.livestreamId, input.livestreamId),
                    eq(liveChatMessages.isFlagged, false),
                ),
                with: {
                    user: { columns: { name: true, imageUrl: true } },
                },
                orderBy: [desc(liveChatMessages.createdAt)],
                limit: input.limit,
            });
        }),

    // ----------------------------------------------------------------
    // GET STUDIO STREAMS
    // ----------------------------------------------------------------
    getStudioStreams: protectedProcedure
        .query(async ({ ctx }) => {
            const { id: userId } = ctx.user;
            return db.query.livestreams.findMany({
                where: eq(livestreams.userId, userId),
                orderBy: [desc(livestreams.createdAt)],
            });
        }),
});