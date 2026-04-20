import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import Mux from "@mux/mux-node";
import { db } from "@/src/db";
import { livestreams } from "@/src/db/schema";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

// Mux event types we care about for live streams
type MuxLiveEvent =
    | "video.live_stream.active"
    | "video.live_stream.idle"
    | "video.live_stream.disabled"
    | "video.live_stream.connected"
    | "video.live_stream.disconnected"
    | "video.live_stream.recording";

export async function POST(req: Request) {
    const headersList = await headers();
    const muxSignature = headersList.get("mux-signature");
    const body = await req.text();

    // Verify the webhook is actually from Mux
    try {
        mux.webhooks.verifySignature(
            body,
            { "mux-signature": muxSignature ?? "" },
            process.env.MUX_WEBHOOK_SECRET!,
        );
    } catch {
        return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body) as {
        type: MuxLiveEvent;
        data: {
            id: string;            // Mux live stream ID
            status: string;
            playback_ids?: { id: string; policy: string }[];
        };
    };

    const muxStreamId = event.data.id;

    // ----------------------------------------------------------------
    // Route events → DB updates
    // ----------------------------------------------------------------
    switch (event.type) {

        // Broadcaster connected and is actively streaming
        case "video.live_stream.active": {
            await db
                .update(livestreams)
                .set({
                    status: "active",
                    isLive: true,
                    startedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(livestreams.muxStreamId, muxStreamId));
            break;
        }

        // Broadcaster disconnected / stream paused
        case "video.live_stream.idle":
        case "video.live_stream.disconnected": {
            await db
                .update(livestreams)
                .set({
                    status: "idle",
                    isLive: false,
                    updatedAt: new Date(),
                })
                .where(eq(livestreams.muxStreamId, muxStreamId));
            break;
        }

        // Stream was disabled (e.g. creator ended it or moderation)
        case "video.live_stream.disabled": {
            await db
                .update(livestreams)
                .set({
                    status: "ended",
                    isLive: false,
                    endedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(livestreams.muxStreamId, muxStreamId));
            break;
        }

        default:
            // Ignore other Mux events (asset events are handled by your existing webhook)
            break;
    }

    return new Response("OK", { status: 200 });
}