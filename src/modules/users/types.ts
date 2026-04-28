import { inferRouterOutputs } from "@trpc/server";

import { AppRouter } from "@/src/trpc/routers/_app";

export type UserGetOneOutput = 
  inferRouterOutputs<AppRouter>["users"]["getOne"];