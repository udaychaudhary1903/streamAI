import { usersRouter } from '@/src/modules/users/server/procedures';
import { categoriesRouter } from '@/src/modules/categories/server/procedures';
import { studioRouter } from '@/src/modules/studio/server/procedures';
import { commentsRouter } from '@/src/modules/comments/server/procedures';
import { searchRouter } from '@/src/modules/search/server/procedures';
import { videosRouter } from '@/src/modules/videos/server/procedures';
import { playlistsRouter } from '@/src/modules/playlists/server/procedures';
import { videoViewsRouter } from '@/src/modules/video-views/server/procedures';
import { videoReactionsRouter } from '@/src/modules/video-reactions/server/procedures';
import { commentReactionsRouter } from '@/src/modules/comment-reactions/server/procedures';
import { subscriptionsRouter } from '@/src/modules/subscriptions/server/procedures';
import { livestreamsRouter } from '@/src/modules/livestreams/server/procedures'; 
import { suggestionsRouter } from '@/src/modules/suggestions/server/procedures';

import { createTRPCRouter } from '../init';

export const appRouter = createTRPCRouter({
    studio: studioRouter,
    videos: videosRouter,
    users: usersRouter,
    comments: commentsRouter,
    playlists: playlistsRouter,
    search: searchRouter,
    categories: categoriesRouter,
    videoViews: videoViewsRouter,
    subscriptions: subscriptionsRouter,
    videoReactions: videoReactionsRouter,
    commentReactions: commentReactionsRouter,
    livestreams: livestreamsRouter,  // NEW
    suggestions: suggestionsRouter,
});

export type AppRouter = typeof appRouter;