import { db } from "@/src/db";
import { categories } from "@/src/db/schema";
import { baseProcedure, createTRPCRouter } from "@/src/trpc/init";

export const categoriesRouter = createTRPCRouter({
    getMany: baseProcedure.query(async () => {
        const data = await db.select().from(categories);

        return data;
    }),
});