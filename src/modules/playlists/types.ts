import { inferRouterOutputs } from "@trpc/server";

import { AppRouter } from "@/src/trpc/routers/_app";

export type PlaylistGetManyOutput = 
  inferRouterOutputs<AppRouter>["playlists"]["getMany"];