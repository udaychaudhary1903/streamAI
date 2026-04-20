import { relations } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from "drizzle-zod";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").unique().notNull(),
    name: text("name").notNull(),
    // TODO: ADD BANNER FIELDS
    imageUrl: text("image_url").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("clerk_id_idx").on(t.clerkId)]);

export const userRelations = relations(users, ({ many }) => ({
    videos: many(videos),
}));

export const categories = pgTable("categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("name_idx").on(t.name)]);

export const categoryRelations = relations(users, ({ many }) => ({
    videos: many(videos),
}));

export const videoVisibility = pgEnum("video visibility",[
    "private",
    "public",
]);

export const videos = pgTable("videos", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    muxStatus: text("mux_status"),
    muxAssetId: text("mux_asset_id").unique(),
    muxUploadId: text("mux_upload_id").unique(),
    muxPlaybackId: text("mux_playback_id").unique(),
    muxTrackId: text("mux_track_id").unique(),
    muxTrackStatus: text("mux_track_status"),
    thumbnailUrl: text("thumbnail_url"),
    thumbnailKey: text("thumbnail_key"),
    previewUrl: text("preview.url"),
    previewKey: text("preview.key"),
    duration: integer("duration").default(0).notNull(),
    visibility: videoVisibility("visibility").default("private").notNull(),
    userId: uuid("user_id").references(() => users.id, {
        onDelete: "cascade",
    }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
        onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const videoInsertSchema = createInsertSchema(videos);
export const videoUpdateSchema = createUpdateSchema(videos);
export const videoSelectSchema = createSelectSchema(videos);

export const videoRelations = relations(videos, ({ one }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [videos.categoryId],
    references: [categories.id],
  }),
}));

// Livestream status enum

export const livestreamStatus = pgEnum("livestream_status", [
    "idle",       // created, not yet live
    "active",     // currently streaming
    "ended",      // stream finished
    "disabled",   // banned / moderation action
]);
 
// ----------------------------------------------------------
// LIVESTREAMS TABLE
// ----------------------------------------------------------
 
export const livestreams = pgTable("livestreams", {
    id: uuid("id").primaryKey().defaultRandom(),
 
    // Creator
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
 
    // Display
    title: text("title").notNull().default("Untitled Stream"),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    categoryId: uuid("category_id").references(() => categories.id, {
        onDelete: "set null",
    }),
 
    // Mux Live fields
    muxStreamId: text("mux_stream_id").unique(),       // Mux live stream ID
    muxStreamKey: text("mux_stream_key"),              // RTMP stream key (shown to creator)
    muxPlaybackId: text("mux_playback_id").unique(),   // Used in HLS player URL
    muxLivePlaybackId: text("mux_live_playback_id"),   // Low-latency playback ID
 
    // Status
    status: livestreamStatus("status").default("idle").notNull(),
    isLive: boolean("is_live").default(false).notNull(),
 
    // AI fields (from your methodology diagram)
    aiModerationEnabled: boolean("ai_moderation_enabled").default(true).notNull(),
    aiHighlightsEnabled: boolean("ai_highlights_enabled").default(true).notNull(),
    lastModerationFlag: text("last_moderation_flag"),  // e.g. "explicit_language"
    highlightClips: text("highlight_clips"),            // JSON string of highlight timestamps
 
    // Visibility
    visibility: videoVisibility("visibility").default("public").notNull(),
 
    // Timestamps
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
 
// ----------------------------------------------------------
// RELATIONS
// ----------------------------------------------------------
 
export const livestreamRelations = relations(livestreams, ({ one, many }) => ({
    user: one(users, {
        fields: [livestreams.userId],
        references: [users.id],
    }),
    category: one(categories, {
        fields: [livestreams.categoryId],
        references: [categories.id],
    }),
    chatMessages: many(liveChatMessages),
}));
 
// Also ADD `livestreams: many(livestreams)` inside your existing userRelations
 
// ----------------------------------------------------------
// LIVE CHAT MESSAGES TABLE
// ----------------------------------------------------------
 
export const liveChatMessages = pgTable("live_chat_messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    livestreamId: uuid("livestream_id")
        .references(() => livestreams.id, { onDelete: "cascade" })
        .notNull(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    message: text("message").notNull(),
    // AI moderation
    isFlagged: boolean("is_flagged").default(false).notNull(),
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});
 
export const liveChatRelations = relations(liveChatMessages, ({ one }) => ({
    livestream: one(livestreams, {
        fields: [liveChatMessages.livestreamId],
        references: [livestreams.id],
    }),
    user: one(users, {
        fields: [liveChatMessages.userId],
        references: [users.id],
    }),
}));
 
// ----------------------------------------------------------
// ZOD SCHEMAS
// ----------------------------------------------------------
 
export const livestreamInsertSchema = createInsertSchema(livestreams);
export const livestreamUpdateSchema = createUpdateSchema(livestreams);
export const livestreamSelectSchema = createSelectSchema(livestreams);
 