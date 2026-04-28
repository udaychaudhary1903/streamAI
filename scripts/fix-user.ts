import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { pgTable, text, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import ws from "ws";

dotenv.config({ path: ".env.local" });

neonConfig.webSocketConstructor = ws;

const CLERK_USER_ID = "user_3CqzE1iwkQi2DIriqbIFGeUdw43";
const FULL_NAME     = "Uday Chaudhary";
const IMAGE_URL     = "https://img.clerk.com/eyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL2ltYWdlcy5jbGVyay5kZXYvb2F1dGhfZ29vZ2xlL2ltZ18zQ3F6RTJTMXNtaGJzYklFbFVGYnJubjNIbEcifQ";

const users = pgTable("users", {
    id:        uuid("id").primaryKey().defaultRandom(),
    clerkId:   text("clerk_id").unique().notNull(),
    name:      text("name").notNull(),
    imageUrl:  text("image_url").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("clerk_id_idx").on(t.clerkId)]);

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL not found in .env.local");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);

    const allUsers = await db.select().from(users);
    console.log(`\n📋 Users in DB: ${allUsers.length}`);
    allUsers.forEach(u => console.log(`   • ${u.clerkId}  →  ${u.name}`));

    const existing = await db.select().from(users)
        .where(eq(users.clerkId, CLERK_USER_ID));

    if (existing.length > 0) {
        console.log(`\n✅ Your user EXISTS in DB already.`);
        console.log(`   id:      ${existing[0].id}`);
        console.log(`   clerkId: ${existing[0].clerkId}`);
        console.log(`   name:    ${existing[0].name}`);
        console.log(`\n→ Run: bun run dev:all then sign out and back in.`);
        await pool.end();
        return;
    }

    console.log(`\n❌ User NOT in DB. Inserting...`);
    const [inserted] = await db.insert(users).values({
        clerkId:  CLERK_USER_ID,
        name:     FULL_NAME,
        imageUrl: IMAGE_URL,
    }).returning();

    console.log(`\n✅ Done! User inserted:`);
    console.log(`   clerkId: ${inserted.clerkId}`);
    console.log(`   name:    ${inserted.name}`);
    console.log(`\n→ Now run: bun run dev:all`);
    console.log(`→ Sign out and back in at localhost:3000`);

    await pool.end();
}

run().catch(console.error);