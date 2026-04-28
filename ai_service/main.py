from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import json
from dotenv import load_dotenv
from datetime import datetime, timedelta
from collections import defaultdict

load_dotenv()

app = FastAPI()

# Allow Next.js to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# LAYER 1: CONTENT MODERATION (NLP + Vision AI)
# Called from: sendChatMessage in livestreams/procedures.ts

class ModerateTextRequest(BaseModel):
    text: str

class ModerateImageRequest(BaseModel):
    image_url: str

# Profanity list — Python version (more powerful with regex)
import re
BLOCKED_WORDS = [
    "mc", "mcbc", "bc", "bhenchod", "madarchod", "chutiya", "gaandu",
    "randi", "harami", "bhadwa", "bsdk", "lodu", "lund", "chut",
    "fuck", "shit", "bitch", "pussy", "ass", "asshole", "bastard",
    "cunt", "dick", "cock", "nigger", "nigga", "slut", "whore",
]

def check_profanity(text: str) -> Optional[str]:
    clean = re.sub(r'[^a-z0-9\s]', '', text.lower())
    for word in BLOCKED_WORDS:
        if re.search(r'\b' + word + r'\b', clean):
            return word
    return None

@app.post("/moderate/text")
async def moderate_text(req: ModerateTextRequest):
    # Layer 1: instant profanity check
    blocked = check_profanity(req.text)
    if blocked:
        return {
            "flagged": True,
            "reason": "profanity",
            "word": blocked,
            "source": "profanity_filter"
        }

    # Layer 2: OpenAI moderation API
    try:
        import openai
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        result = client.moderations.create(input=req.text)
        flagged = result.results[0].flagged
        if flagged:
            cats = result.results[0].categories.model_dump()
            reason = next((k for k, v in cats.items() if v), "policy_violation")
            return {
                "flagged": True,
                "reason": reason,
                "source": "openai"
            }
    except Exception as e:
        print(f"OpenAI moderation error: {e}")

    return {"flagged": False, "reason": None, "source": "clean"}


@app.post("/moderate/image")
async def moderate_image(req: ModerateImageRequest):
    """Check thumbnail for inappropriate content using Google Gemini Vision"""
    try:
        import google.generativeai as genai
        import httpx
        import base64

        genai.configure(api_key=os.getenv("GOOGLE_AI_API_KEY"))
        model = genai.GenerativeModel("gemini-1.5-flash")

        # Download image
        async with httpx.AsyncClient() as client:
            r = await client.get(req.image_url)
            img_data = base64.b64encode(r.content).decode()

        result = model.generate_content([
            {"mime_type": "image/jpeg", "data": img_data},
            'Is this image safe for a streaming platform? Reply ONLY with JSON: {"safe": true/false, "reason": "string"}'
        ])

        text = result.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)

    except Exception as e:
        print(f"Image moderation error: {e}")
        return {"safe": True, "reason": "Analysis unavailable"}



# 2: HIGHLIGHT DETECTION (Chat activity spikes)
# Called from: studio page when stream ends


class HighlightRequest(BaseModel):
    livestream_id: str
    started_at: str   # ISO datetime string
    messages: list[dict]   # [{message: str, created_at: str}]

@app.post("/highlights/detect")
async def detect_highlights(req: HighlightRequest):
    if len(req.messages) < 10:
        return {"highlights": [], "reason": "Not enough chat data"}

    start_time = datetime.fromisoformat(req.started_at.replace("Z", "+00:00"))
    window_size = 30  # seconds

    # Count messages per 30-second window
    windows: dict[int, int] = defaultdict(int)
    for msg in req.messages:
        msg_time = datetime.fromisoformat(msg["created_at"].replace("Z", "+00:00"))
        elapsed = (msg_time - start_time).total_seconds()
        window_idx = int(elapsed // window_size)
        windows[window_idx] += 1

    if not windows:
        return {"highlights": [], "reason": "No timestamped messages"}

    counts = list(windows.values())
    avg = sum(counts) / len(counts)
    threshold = avg * 3  # 3x average = highlight

    highlights = [
        {
            "timestamp_seconds": int(w) * window_size,
            "chat_activity": count,
            "label": f"High activity moment ({count} messages in 30s)"
        }
        for w, count in windows.items()
        if count >= threshold
    ]

    highlights.sort(key=lambda x: x["chat_activity"], reverse=True)
    highlights = highlights[:5]  # top 5

    # Use Groq to generate AI labels for highlights
    if highlights and os.getenv("GROQ_API_KEY"):
        try:
            from groq import Groq
            client = Groq(api_key=os.getenv("GROQ_API_KEY"))

            prompt = f"""A live stream had these high-activity moments:
{chr(10).join([f"- At {h['timestamp_seconds']//60}m{h['timestamp_seconds']%60}s: {h['chat_activity']} messages in 30s" for h in highlights])}

Generate short exciting labels (max 5 words each). Return ONLY a JSON array of strings."""

            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}]
            )

            text = response.choices[0].message.content
            text = text.replace("```json", "").replace("```", "").strip()
            labels = json.loads(text)

            for i, h in enumerate(highlights):
                if i < len(labels):
                    h["label"] = labels[i]

        except Exception as e:
            print(f"Groq labeling error: {e}")

    return {"highlights": highlights}

# 3: RECOMMENDATION ENGINE (Collaborative + Content-based)
# Called from: video suggestions on watch page

class RecommendationRequest(BaseModel):
    video_id: str
    viewer_id: Optional[str] = None       # current user's DB id
    category_id: Optional[str] = None     # current video's category
    viewed_ids: list[str] = []            # videos user already saw
    similar_viewer_ids: list[str] = []    # users who watched same video
    subscribed_creator_ids: list[str] = [] # creators user follows
    candidate_videos: list[dict] = []     # [{id, title, like_count, view_count, updated_at, user_id}]

@app.post("/recommend")
async def get_recommendations(req: RecommendationRequest):
    """
    AI-powered recommendation scoring.
    Scores each candidate video and returns ranked list of IDs.
    """
    from datetime import timezone

    now = datetime.now(timezone.utc)
    scored = []

    for video in req.candidate_videos:
        score = 0.0
        reasons = []

        # 1. Recency score (newer = higher, decay over 30 days)
        try:
            updated = datetime.fromisoformat(video["updated_at"].replace("Z", "+00:00"))
            days_old = (now - updated).days
            recency = max(0, 10 - days_old * 0.33)
            score += recency
        except Exception:
            pass

        # 2. Popularity (likes + views, capped to prevent domination)
        like_score = min(video.get("like_count", 0) * 0.3, 10)
        view_score = min(video.get("view_count", 0) * 0.05, 5)
        score += like_score + view_score

        # 3. Collaborative boost — similar users watched this
        if video["id"] in (req.similar_viewer_ids or []):
            score += 15
            reasons.append("Watched by similar users")

        # 4. Subscription boost — from creator user follows
        if video.get("user_id") in req.subscribed_creator_ids:
            score += 10
            reasons.append("From a creator you follow")

        # 5. Not-yet-seen bonus — encourage discovery
        if video["id"] not in req.viewed_ids:
            score += 3

        scored.append({
            "id": video["id"],
            "score": round(score, 2),
            "reason": reasons[0] if reasons else "Similar content"
        })

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)

    return {
        "ranked_ids": [v["id"] for v in scored],
        "scored": scored[:10]  # return top 10 with scores for debugging
    }


# 4: AI TITLE / DESCRIPTION GENERATION
# Called from: studio livestream page (AI generate button)

class GenerateTitleRequest(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    stream_type: str = "general"

@app.post("/generate/title")
async def generate_title(req: GenerateTitleRequest):
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))

        context = req.description or f"a {req.category or req.stream_type} live stream"
        prompt = f'Generate a short, catchy live stream title (max 60 chars) for: "{context}". Return ONLY the title, no quotes, no explanation.'

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}]
        )

        title = response.choices[0].message.content.strip().strip('"').strip("'")
        return {"title": title}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# Health check
# ================================================================

@app.get("/health")
async def health():
    return {"status": "ok", "service": "streamify-ai"}


# Run with: uvicorn main:app --reload --port 8000