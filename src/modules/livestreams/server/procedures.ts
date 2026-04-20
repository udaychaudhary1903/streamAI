import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import Mux from "@mux/mux-node";

import { db } from "@/src/db";
import { users, livestreams, liveChatMessages } from "@/src/db/schema";
import { createTRPCRouter, protectedProcedure, baseProcedure } from "@/src/trpc/init";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export const livestreamsRouter = createTRPCRouter({

    // ----------------------------------------------------------------
    // CREATE — Studio: creator clicks "Go Live" setup
    // ----------------------------------------------------------------
    create: protectedProcedure
        .input(z.object({
            title: z.string().min(1).max(100),
            description: z.string().optional(),
            categoryId: z.string().uuid().optional(),
            visibility: z.enum(["public", "private"]).default("public"),
        }))
        .mutation(async ({ ctx, input }) => {
            const { id: userId } = await db.query.users.findFirst({
                where: eq(users.clerkId, ctx.userId),
                columns: { id: true },
            }).then(u => {
                if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
                return u;
            });

            // Create a Mux live stream (low-latency)
            const muxStream = await mux.video.liveStreams.create({
                playback_policy: [input.visibility === "public" ? "public" : "signed"],
                new_asset_settings: { playback_policy: ["public"] },
                latency_mode: "low",
                reconnect_window: 60,
            });

            const playbackId = muxStream.playback_ids?.[0]?.id;

            const [livestream] = await db.insert(livestreams).values({
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
            }).returning();

            return livestream;
        }),

    // ----------------------------------------------------------------
    // GET ONE — for the viewer page & studio page
    // ----------------------------------------------------------------
    getOne: baseProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
            const livestream = await db.query.livestreams.findFirst({
                where: eq(livestreams.id, input.id),
                with: {
                    user: { columns: { id: true, name: true, imageUrl: true } },
                    category: { columns: { id: true, name: true } },
                },
            });
            if (!livestream) throw new TRPCError({ code: "NOT_FOUND" });
            return livestream;
        }),

    // ----------------------------------------------------------------
    // GET MANY — home page live section (public, currently live)
    // ----------------------------------------------------------------
    getMany: baseProcedure
        .input(z.object({
            categoryId: z.string().uuid().optional(),
            limit: z.number().min(1).max(50).default(20),
            cursor: z.string().uuid().optional(),
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
                limit: input.limit + 1,
            });

            let nextCursor: string | undefined;
            if (data.length > input.limit) {
                const next = data.pop();
                nextCursor = next?.id;
            }

            return { items: data, nextCursor };
        }),

    // ----------------------------------------------------------------
    // GET STUDIO STREAMS — creator's own streams
    // ----------------------------------------------------------------
    getStudioStreams: protectedProcedure
        .query(async ({ ctx }) => {
            const user = await db.query.users.findFirst({
                where: eq(users.clerkId, ctx.userId),
                columns: { id: true },
            });
            if (!user) throw new TRPCError({ code: "NOT_FOUND" });

            return db.query.livestreams.findMany({
                where: eq(livestreams.userId, user.id),
                orderBy: [desc(livestreams.createdAt)],
            });
        }),

    // ----------------------------------------------------------------
    // UPDATE — edit title/description/category before going live
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
            const user = await db.query.users.findFirst({
                where: eq(users.clerkId, ctx.userId),
                columns: { id: true },
            });
            if (!user) throw new TRPCError({ code: "NOT_FOUND" });

            const { id, ...data } = input;
            const [updated] = await db
                .update(livestreams)
                .set({ ...data, updatedAt: new Date() })
                .where(and(eq(livestreams.id, id), eq(livestreams.userId, user.id)))
                .returning();

            if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
            return updated;
        }),

    // ----------------------------------------------------------------
    // END STREAM — creator clicks "End Stream"
    // ----------------------------------------------------------------
    end: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const user = await db.query.users.findFirst({
                where: eq(users.clerkId, ctx.userId),
                columns: { id: true },
            });
            if (!user) throw new TRPCError({ code: "NOT_FOUND" });

            const stream = await db.query.livestreams.findFirst({
                where: and(
                    eq(livestreams.id, input.id),
                    eq(livestreams.userId, user.id),
                ),
            });
            if (!stream) throw new TRPCError({ code: "NOT_FOUND" });

            // Disable the Mux stream so no one can reconnect
            if (stream.muxStreamId) {
                await mux.video.liveStreams.disable(stream.muxStreamId);
            }

            const [updated] = await db
                .update(livestreams)
                .set({
                    status: "ended",
                    isLive: false,
                    endedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(livestreams.id, input.id))
                .returning();

            return updated;
        }),

    // ----------------------------------------------------------------
    // DELETE — remove stream record + Mux stream
    // ----------------------------------------------------------------
    delete: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const user = await db.query.users.findFirst({
                where: eq(users.clerkId, ctx.userId),
                columns: { id: true },
            });
            if (!user) throw new TRPCError({ code: "NOT_FOUND" });

            const stream = await db.query.livestreams.findFirst({
                where: and(
                    eq(livestreams.id, input.id),
                    eq(livestreams.userId, user.id),
                ),
            });
            if (!stream) throw new TRPCError({ code: "NOT_FOUND" });

            if (stream.muxStreamId) {
                await mux.video.liveStreams.delete(stream.muxStreamId).catch(() => null);
            }

            await db.delete(livestreams).where(eq(livestreams.id, input.id));
            return { success: true };
        }),

    // ----------------------------------------------------------------
    // CHAT — send a message (with AI moderation)
    // ----------------------------------------------------------------
    sendChatMessage: protectedProcedure
        .input(z.object({
            livestreamId: z.string().uuid(),
            message: z.string().min(1).max(500),
        }))
        .mutation(async ({ ctx, input }) => {
            const user = await db.query.users.findFirst({
                where: eq(users.clerkId, ctx.userId),
            });
            if (!user) throw new TRPCError({ code: "NOT_FOUND" });

            // Quick AI moderation check via OpenAI moderation endpoint
            let isFlagged = false;
            let flagReason: string | undefined;
            try {
                const modRes = await fetch("https://api.openai.com/v1/moderations", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    },
                    body: JSON.stringify({ input: input.message }),
                });
                const mod = await modRes.json();
                isFlagged = mod.results?.[0]?.flagged ?? false;
                if (isFlagged) {
                    const cats = mod.results[0].categories;
                    flagReason = Object.keys(cats).find(k => cats[k]) ?? "policy_violation";
                }
            } catch {
                // If moderation fails, still allow message
            }

            if (isFlagged) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Your message was flagged by our AI moderation system.",
                });
            }

            const [msg] = await db.insert(liveChatMessages).values({
                livestreamId: input.livestreamId,
                userId: user.id,
                message: input.message,
                isFlagged,
                flagReason,
            }).returning();

            return { ...msg, user: { name: user.name, imageUrl: user.imageUrl } };
        }),

    // ----------------------------------------------------------------
    // CHAT — get messages for a stream
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
});