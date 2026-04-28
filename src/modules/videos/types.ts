import { inferRouterOutputs } from "@trpc/server";

import { AppRouter } from "@/src/trpc/routers/_app";

export type VideoGetOneOutput = 
  inferRouterOutputs<AppRouter>["videos"]["getOne"];
  
// TODO: Change to videos getMany
export type VideoGetManyOutput = 
  inferRouterOutputs<AppRouter>["suggestions"]["getMany"];