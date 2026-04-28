// lib/ai-client.ts
// This file is called from your tRPC procedures to talk to Python

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// ================================================================
// CONTENT MODERATION
// Called in: sendChatMessage procedure
// ================================================================

export async function moderateText(text: string): Promise<{
    flagged: boolean;
    reason: string | null;
    source: string;
}> {
    try {
        const res = await fetch(`${AI_SERVICE_URL}/moderate/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(3000), // 3 second timeout
        });

        if (!res.ok) throw new Error(`AI service error: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("[ai-client] moderateText failed:", e);
        // Fallback: allow message if Python service is down
        return { flagged: false, reason: null, source: "fallback" };
    }
}

export async function moderateImage(imageUrl: string): Promise<{
    safe: boolean;
    reason: string;
}> {
    try {
        const res = await fetch(`${AI_SERVICE_URL}/moderate/image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: imageUrl }),
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) throw new Error(`AI service error: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("[ai-client] moderateImage failed:", e);
        return { safe: true, reason: "Analysis unavailable" };
    }
}


// ================================================================
// HIGHLIGHT DETECTION
// Called in: livestreams.end procedure (or detectHighlights mutation)
// ================================================================

export async function detectHighlights(params: {
    livestreamId: string;
    startedAt: Date;
    messages: Array<{ message: string; createdAt: Date }>;
}): Promise<{
    highlights: Array<{
        timestamp_seconds: number;
        chat_activity: number;
        label: string;
    }>;
}> {
    try {
        const res = await fetch(`${AI_SERVICE_URL}/highlights/detect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                livestream_id: params.livestreamId,
                started_at: params.startedAt.toISOString(),
                messages: params.messages.map(m => ({
                    message: m.message,
                    created_at: m.createdAt.toISOString(),
                })),
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) throw new Error(`AI service error: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("[ai-client] detectHighlights failed:", e);
        return { highlights: [] };
    }
}


// ================================================================
// RECOMMENDATION ENGINE
// Called in: suggestions procedures
// ================================================================

export async function getAIRecommendations(params: {
    videoId: string;
    viewerId?: string;
    categoryId?: string | null;
    viewedIds: string[];
    similarViewerIds: string[];
    subscribedCreatorIds: string[];
    candidateVideos: Array<{
        id: string;
        title: string;
        likeCount: number;
        viewCount: number;
        updatedAt: Date;
        userId: string;
    }>;
}): Promise<{
    rankedIds: string[];
    scored: Array<{ id: string; score: number; reason: string }>;
}> {
    try {
        const res = await fetch(`${AI_SERVICE_URL}/recommend`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                video_id: params.videoId,
                viewer_id: params.viewerId,
                category_id: params.categoryId,
                viewed_ids: params.viewedIds,
                similar_viewer_ids: params.similarViewerIds,
                subscribed_creator_ids: params.subscribedCreatorIds,
                candidate_videos: params.candidateVideos.map(v => ({
                    id: v.id,
                    title: v.title,
                    like_count: v.likeCount,
                    view_count: v.viewCount,
                    updated_at: v.updatedAt.toISOString(),
                    user_id: v.userId,
                })),
            }),
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) throw new Error(`AI service error: ${res.status}`);
        const data = await res.json();
        return {
            rankedIds: data.ranked_ids,
            scored: data.scored,
        };
    } catch (e) {
        console.error("[ai-client] getAIRecommendations failed:", e);
        // Fallback: return original order
        return {
            rankedIds: params.candidateVideos.map(v => v.id),
            scored: [],
        };
    }
}


// ================================================================
// TITLE GENERATION
// Called in: generateTitle mutation
// ================================================================

export async function generateStreamTitle(params: {
    description?: string;
    category?: string;
}): Promise<string> {
    try {
        const res = await fetch(`${AI_SERVICE_URL}/generate/title`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                description: params.description,
                category: params.category,
            }),
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) throw new Error(`AI service error: ${res.status}`);
        const data = await res.json();
        return data.title;
    } catch (e) {
        console.error("[ai-client] generateStreamTitle failed:", e);
        throw new Error("Failed to generate title");
    }
}