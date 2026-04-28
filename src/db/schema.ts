import { relations } from "drizzle-orm";
import { boolean, foreignKey, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from "drizzle-zod";

export const reactionType = pgEnum("reaction_type", ["like", "dislike"]);

export const playlistVideos = pgTable("playlist_videos", {
  playlistId: uuid("playlist_id").references(() => playlists.id, { onDelete: "cascade" }).notNull(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "playlist_videos_pk",
    columns: [t.playlistId, t.videoId],
  }),
]);

export const playlistVideoRelations = relations(playlistVideos, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistVideos.playlistId],
    references: [playlists.id],
  }),
  video: one(videos, {
    fields: [playlistVideos.videoId],
    references: [videos.id],
  }),
}));

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const playlistRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, {
    fields: [playlists.userId],
    references: [users.id],
  }),
  playlistVideos: many(playlistVideos),
}));


export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").unique().notNull(),
    name: text("name").notNull(),
    bannerUrl: text("banner_url"),
    bannerKey: text("banner_key"),
    imageUrl: text("image_url").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("clerk_id_idx").on(t.clerkId)]);

export const userRelations = relations(users, ({ many }) => ({
    videos: many(videos),
    videoViews: many(videoViews),
    videoReactions: many(videoReactions),
    subscriptions: many(subscriptions, {
      relationName: "subscriptions_viewer_id_fkey"
    }),
    subscribers: many(subscriptions, {
      relationName: "subscriptions_creator_id_fkey"
    }),
    comments: many(comments),
    commentReactions: many(commentReactions),
    livestreams: many(livestreams),
}));

export const subscriptions = pgTable("subscriptions", {
  viewerId: uuid("viewer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  creatorId: uuid("creator_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "subscriptions_pk",
    columns: [t.viewerId, t.creatorId],
  }),
]);

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  viewer: one(users, {
    fields: [subscriptions.viewerId],
    references: [users.id],
    relationName: "subscriptions_viewer_id_fkey",
  }),
  creator: one(users, {
    fields: [subscriptions.creatorId],
    references: [users.id],
    relationName: "subscriptions_creator_id_fkey",
  }),
}));

export const categories = pgTable("categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("name_idx").on(t.name)]);

export const categoryRelations = relations(categories, ({ many }) => ({
    videos: many(videos),
    livestreams: many(livestreams),
}));

export const videoVisibility = pgEnum("video visibility", [
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

export const videoRelations = relations(videos, ({ one, many }) => ({
    user: one(users, {
        fields: [videos.userId],
        references: [users.id],
    }),
    category: one(categories, {
        fields: [videos.categoryId],
        references: [categories.id],
    }),
    views: many(videoViews),
    reactions: many(videoReactions),
    comments: many(comments),
    playlistVideos: many(playlistVideos),
}));

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => {
  return [
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "comments_parent_id_fkey",
    })
    .onDelete("cascade"),
  ]
});

export const commentRelations = relations(comments, ({ one, many }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [comments.videoId],
    references: [videos.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comments_parent_id_fkey",
  }),
  reactions: many(commentReactions),
  replies: many(comments, {
    relationName: "comments_parent_id_fkey",
  }),
}));

export const commentSelectSchema = createSelectSchema(comments);
export const commentInsertSchema = createInsertSchema(comments);
export const commentUpdateSchema = createUpdateSchema(comments);

export const commentReactions = pgTable("comment_reactions", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }).notNull(),
  type: reactionType("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "comment_reactions_pk",
    columns: [t.userId, t.commentId],
  }),
]);

export const commentReactionRelations = relations(commentReactions, ({ one }) => ({
  user: one(users, {
    fields: [commentReactions.userId],
    references: [users.id],
  }),
  comment: one(comments, {
    fields: [commentReactions.commentId],
    references: [comments.id],
  }),
}));

export const videoViews = pgTable("video_views", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "video_views_pk",
    columns: [t.userId, t.videoId],
  }),
]);

export const videoViewRelations = relations(videoViews, ({ one }) => ({
  user: one(users, {
    fields: [videoViews.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoViews.videoId],
    references: [videos.id],
  })
}));

export const videoViewSelectSchema = createSelectSchema(videoViews);
export const videoViewInsertSchema = createInsertSchema(videoViews);
export const videoViewUpdateSchema = createUpdateSchema(videoViews);

export const videoReactions = pgTable("video_reactions", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  type: reactionType("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "video_reactions_pk",
    columns: [t.userId, t.videoId],
  }),
]);

export const videoReactionRelations = relations(videoReactions, ({ one }) => ({
  user: one(users, {
    fields: [videoReactions.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoReactions.videoId],
    references: [videos.id],
  })
}));

export const videoReactionSelectSchema = createSelectSchema(videoReactions);
export const videoReactionInsertSchema = createInsertSchema(videoReactions);
export const videoReactionUpdateSchema = createUpdateSchema(videoReactions);

//livestream set-up
export const livestreamStatus = pgEnum("livestream_status", [
    "idle",
    "active",
    "ended",
    "disabled",
]);

export const livestreams = pgTable("livestreams", {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),

    title: text("title").notNull().default("Untitled Stream"),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    categoryId: uuid("category_id").references(() => categories.id, {
        onDelete: "set null",
    }),

    muxStreamId: text("mux_stream_id").unique(),
    muxStreamKey: text("mux_stream_key"),
    muxPlaybackId: text("mux_playback_id").unique(),

    status: livestreamStatus("status").default("idle").notNull(),
    isLive: boolean("is_live").default(false).notNull(),

    aiModerationEnabled: boolean("ai_moderation_enabled").default(true).notNull(),
    aiHighlightsEnabled: boolean("ai_highlights_enabled").default(true).notNull(),
    lastModerationFlag: text("last_moderation_flag"),
    highlightClips: text("highlight_clips"),

    visibility: videoVisibility("visibility").default("public").notNull(),

    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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

export const livestreamInsertSchema = createInsertSchema(livestreams);
export const livestreamUpdateSchema = createUpdateSchema(livestreams);
export const livestreamSelectSchema = createSelectSchema(livestreams);

export const liveChatMessages = pgTable("live_chat_messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    livestreamId: uuid("livestream_id")
        .references(() => livestreams.id, { onDelete: "cascade" })
        .notNull(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    message: text("message").notNull(),
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

export const livestreamReactions = pgTable("livestream_reactions", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  livestreamId: uuid("livestream_id").references(() => livestreams.id, { onDelete: "cascade" }).notNull(),
  type: reactionType("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "livestream_reactions_pk",
    columns: [t.userId, t.livestreamId],
  }),
]);

export const livestreamReactionRelations = relations(livestreamReactions, ({ one }) => ({
  user: one(users, {
    fields: [livestreamReactions.userId],
    references: [users.id],
  }),
  livestream: one(livestreams, {
    fields: [livestreamReactions.livestreamId],
    references: [livestreams.id],
  }),
}));
export const livestreamReactionSelectSchema = createSelectSchema(livestreamReactions);
export const livestreamReactionInsertSchema = createInsertSchema(livestreamReactions);