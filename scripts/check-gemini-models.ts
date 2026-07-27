import "dotenv/config";

console.log("API KEY EXISTS:", !!process.env.GEMINI_API_KEY);
console.log("MODEL:", process.env.AI_MODEL);

import { GoogleGenAI } from "@google/genai";

async function main() {
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });

    const models = await ai.models.list();

    for await (const model of models) {
        console.log(model.name);
    }
}

main().catch(console.error);