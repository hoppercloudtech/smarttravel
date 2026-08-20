// lib/tiktok/caption.ts
//
// Turns a Place's structured data into a TikTok caption + hashtags, using
// the same Gemini provider your AI summary pipeline (lib/ai.ts) already
// runs on — not a copy of the destination description, a rewrite for the
// platform.

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.AI_MODEL || "gemini-2.0-flash-001";

export type CaptionInput = {
    placeName: string;
    category: string; // human label, e.g. "Hotel", "Restaurant"
    cityName?: string | null;
    countryName: string;
    aiSummary?: string | null; // the place's existing on-site AI summary, if generated
    baseTags: string[]; // from TikTokPostingSettings.hashtagBaseTags
    ctaVariant: string; // pre-selected by the CTA rotation, not chosen by the model
};

export type CaptionResult = {
    caption: string; // includes the CTA, does NOT include hashtags (kept separate per TikTok convention)
    hashtags: string[];
};

export async function generateTikTokCaption(input: CaptionInput): Promise<CaptionResult> {
    const location = [input.cityName, input.countryName].filter(Boolean).join(", ");

    const prompt = `You write TikTok captions for a travel discovery platform's automated posting system.

Write ONE short, engaging TikTok caption (1-2 sentences, under 150 characters) for this place. It must:
- Be based only on the facts given below — never invent amenities, prices, or claims not stated
- Create curiosity rather than just describing the place
- Be written for an international audience (not assuming the reader is local)
- End by naturally working in this exact call-to-action, reworded to fit naturally: "${input.ctaVariant}"
- NOT include hashtags (those are generated separately)
- NOT use excessive emoji — at most 1-2, only if they genuinely fit

Also generate 6-10 hashtags for this specific post, mixing:
- A couple of the platform's base tags (given below) if genuinely relevant
- Destination-specific tags (city/country/region)
- Category-specific tags (e.g. #LuxuryTravel, #FoodTravel, #Backpacking — pick what actually fits)
- 1-2 broader travel-community tags

Facts:
Name: ${input.placeName}
Category: ${input.category}
Location: ${location}
${input.aiSummary ? `Existing description: ${input.aiSummary}` : "No description available — write generically about visiting this type of place in this location."}

Platform base tags to consider: ${input.baseTags.join(", ")}

Return strict JSON: {"caption": "...", "hashtags": ["tag1", "tag2", ...]} — hashtags as plain words, no "#" prefix, no spaces.`;

    const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" },
    });

    const raw = response.text ?? "{}";
    const parsed = JSON.parse(raw) as { caption: string; hashtags: string[] };

    return {
        caption: parsed.caption.trim(),
        hashtags: (parsed.hashtags ?? []).map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
    };
}