import { z } from "zod";
import { and, eq, not, desc, getTableColumns, inArray, lt, or } from "drizzle-orm";
import { db } from "@/src/db";
import { users, videoReactions, videos, videoViews, subscriptions } from "@/src/db/schema";
import { TRPCError } from "@trpc/server";
import { baseProcedure, createTRPCRouter } from "@/src/trpc/init";
import { getAIRecommendations } from "@/lib/ai-client";

export const suggestionsRouter = createTRPCRouter({
    getMany: baseProcedure
        .input(z.object({
            videoId: z.string().uuid(),
            cursor: z.object({
                id: z.string().uuid(),
                updatedAt: z.date(),
            }).nullish(),
            limit: z.number().min(1).max(100),
        }))
        .query(async ({ input, ctx }) => {
            const { videoId, cursor, limit } = input;
            const { clerkUserId } = ctx;

            // Get current video
            const [existingVideo] = await db
                .select()
                .from(videos)
                .where(eq(videos.id, videoId));

            if (!existingVideo) throw new TRPCError({ code: "NOT_FOUND" });

            // Get current viewer if signed in
            let viewerId: string | undefined;
            let viewedIds: string[] = [];
            let subscribedCreatorIds: string[] = [];

            if (clerkUserId) {
                const [viewer] = await db
                    .select()
                    .from(users)
                    .where(eq(users.clerkId, clerkUserId));

                if (viewer) {
                    viewerId = viewer.id;

                    // Videos viewer has already watched
                    const watched = await db
                        .select({ videoId: videoViews.videoId })
                        .from(videoViews)
                        .where(eq(videoViews.userId, viewer.id));
                    viewedIds = watched.map(v => v.videoId);

                    // Creators viewer subscribes to
                    const subs = await db
                        .select({ creatorId: subscriptions.creatorId })
                        .from(subscriptions)
                        .where(eq(subscriptions.viewerId, viewer.id));
                    subscribedCreatorIds = subs.map(s => s.creatorId);
                }
            }

            // Users who also watched this video (collaborative filtering)
            const similarViewers = await db
                .select({ userId: videoViews.userId })
                .from(videoViews)
                .where(eq(videoViews.videoId, videoId))
                .limit(50);

            const similarViewerIds = similarViewers
                .map(v => v.userId)
                .filter(id => id !== viewerId);

            // Get candidate videos (same category or recent public)
            const candidates = await db
                .select({
                    ...getTableColumns(videos),
                    user: users,
                    viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
                    likeCount: db.$count(videoReactions, and(
                        eq(videoReactions.videoId, videos.id),
                        eq(videoReactions.type, "like"),
                    )),
                    dislikeCount: db.$count(videoReactions, and(
                        eq(videoReactions.videoId, videos.id),
                        eq(videoReactions.type, "dislike"),
                    )),
                })
                .from(videos)
                .innerJoin(users, eq(videos.userId, users.id))
                .where(and(
                    not(eq(videos.id, existingVideo.id)),
                    eq(videos.visibility, "public"),
                    existingVideo.categoryId
                        ? eq(videos.categoryId, existingVideo.categoryId)
                        : undefined,
                    cursor
                        ? or(
                            lt(videos.updatedAt, cursor.updatedAt),
                            and(
                                eq(videos.updatedAt, cursor.updatedAt),
                                lt(videos.id, cursor.id),
                            ),
                        )
                        : undefined,
                ))
                .orderBy(desc(videos.updatedAt), desc(videos.id))
                .limit(limit * 3); // fetch 3x more so AI can rerank

            if (candidates.length === 0) {
                return { items: [], nextCursor: null };
            }

            // Send to Python AI service for smart ranking
            const aiResult = await getAIRecommendations({
                videoId,
                viewerId,
                categoryId: existingVideo.categoryId,
                viewedIds,
                similarViewerIds,
                subscribedCreatorIds,
                candidateVideos: candidates.map(v => ({
                    id: v.id,
                    title: v.title,
                    likeCount: v.likeCount,
                    viewCount: v.viewCount,
                    updatedAt: v.updatedAt,
                    userId: v.userId,
                })),
            });

            // Reorder candidates based on AI ranking
            const idToCandidate = new Map(candidates.map(v => [v.id, v]));
            let reranked = aiResult.rankedIds
                .map(id => idToCandidate.get(id))
                .filter(Boolean) as typeof candidates;

            // Fallback to original order if AI failed
            if (reranked.length === 0) reranked = candidates;

            // Apply cursor pagination on reranked results
            const hasMore = reranked.length > limit;
            const items = hasMore ? reranked.slice(0, limit) : reranked;
            const lastItem = items[items.length - 1];
            const nextCursor = hasMore && lastItem
                ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
                : null;

            return { items, nextCursor };
        }),
});