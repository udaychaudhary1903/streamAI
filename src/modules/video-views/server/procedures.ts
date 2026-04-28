import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { videoViews } from "@/src/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/src/trpc/init";

export const videoViewsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { videoId } = input;
      const { id: userId } = ctx.user;

      const [existingVideoView] = await db
        .select()
        .from(videoViews)
        .where(
          and(
            eq(videoViews.videoId, videoId),
            eq(videoViews.userId, userId),
          )
        );

      if (existingVideoView) {
        return existingVideoView;
      }

      const [createdVideoView] = await db
        .insert(videoViews)
        .values({ userId, videoId })
        .returning();

      return createdVideoView;
    }),
});