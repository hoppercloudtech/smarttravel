import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import type { Place } from "@prisma/client";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const MODEL = process.env.AI_MODEL || "gemini-2.0-flash-001";

// Approximate pricing (adjust if Google's pricing changes)
const PRICE_PER_1K_INPUT = 0.00015;
const PRICE_PER_1K_OUTPUT = 0.0006;

export type GeneratedSummary = {
  content: string;
  faq: { question: string; answer: string }[];
  promptTokens: number;
  outputTokens: number;
  estCostUsd: number;
};

export async function generatePlaceSummary(
  place: Place & {
    country: { name: string };
    city: { name: string } | null;
  }
): Promise<GeneratedSummary> {
  const facts = {
    name: place.name,
    category: place.category,
    country: place.country.name,
    city: place.city?.name ?? null,
    district: place.district,
    address: place.address,
    amenities: place.amenities,
    roomTypes: place.roomTypes,
    sourceDescription: place.description,
  };

  const prompt = `
You are a travel content writer for SmartTravel, an East African travel discovery platform.

Write ONLY from the structured facts provided.

Rules:
- Never invent amenities, prices, ratings, reviews, awards or claims.
- Do not use markdown.
- Return ONLY valid JSON.

Required format:

{
  "summary": "2-4 original paragraphs",
  "faq": [
    {
      "question": "...",
      "answer": "..."
    }
  ]
}

Generate between 3 and 5 FAQs.

Facts:

${JSON.stringify(facts, null, 2)}
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const raw = response.text ?? "{}";

  let parsed: {
    summary: string;
    faq: { question: string; answer: string }[];
  };

  try {
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    parsed = JSON.parse(cleaned);

  } catch {
    console.error("Failed to parse Gemini JSON:", raw);

    parsed = {
      summary: "Unable to generate summary.",
      faq: [],
    };
  }

  const usage = response.usageMetadata;

  const promptTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;

  const estCostUsd =
    (promptTokens / 1000) * PRICE_PER_1K_INPUT +
    (outputTokens / 1000) * PRICE_PER_1K_OUTPUT;

  return {
    content: parsed.summary,
    faq: parsed.faq ?? [],
    promptTokens,
    outputTokens,
    estCostUsd,
  };
}

export async function generateAndStoreSummary(
  placeId: string,
  triggeredBy: string
) {
  const place = await prisma.place.findUniqueOrThrow({
    where: {
      id: placeId,
    },
    include: {
      country: true,
      city: true,
    },
  });

  const generated = await generatePlaceSummary(place);

  await prisma.$transaction([
    prisma.aISummary.updateMany({
      where: {
        placeId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    }),

    prisma.aISummary.create({
      data: {
        placeId,
        content: generated.content,
        faqJson: generated.faq,
        model: MODEL,
        promptTokens: generated.promptTokens,
        outputTokens: generated.outputTokens,
        estCostUsd: generated.estCostUsd,
        isCurrent: true,
        triggeredBy,
      },
    }),

    prisma.placeFAQ.deleteMany({
      where: {
        placeId,
      },
    }),

    ...generated.faq.map((faq, index) =>
      prisma.placeFAQ.create({
        data: {
          placeId,
          question: faq.question,
          answer: faq.answer,
          order: index,
        },
      })
    ),

    prisma.place.update({
      where: {
        id: placeId,
      },
      data: {
        refreshStatus: "STABLE",
      },
    }),
  ]);

  return generated;
}