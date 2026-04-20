import { categoriesRouter } from '@/src/modules/categories/server/procedures';
import { createTRPCRouter } from '../init';
import { studioRouter } from '@/src/modules/studio/server/procedures';
import { videosRouter } from '@/src/modules/videos/server/procedures';
import { livestreamsRouter } from '@/src/modules/livestreams/server/procedures';  // NEW

export const appRouter = createTRPCRouter({
    categories: categoriesRouter,
    studio: studioRouter,
    videos: videosRouter,
    livestreams: livestreamsRouter,  // NEW
});

export type AppRouter = typeof appRouter;