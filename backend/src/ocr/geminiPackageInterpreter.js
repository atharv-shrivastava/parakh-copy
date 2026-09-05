import { GoogleGenAI } from "@google/genai";
import {
  buildSemanticPrompt,
  buildSemanticSchema,
  normalizeSemanticResult,
} from "./semanticPackageCommon.js";

export async function interpretPackageWithGemini({ images = [], detections = [], rawText = "", categoryOptions = [], signal } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OCR_AI_API_KEY || "";
  if (!apiKey) {
    return { enabled: false, provider: "gemini", reason: "GEMINI_API_KEY is not configured." };
  }

  const model = process.env.GEMINI_SEMANTIC_MODEL || "gemini-3.7-flash";
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildSemanticPrompt({ detections, rawText, categoryOptions });
  const contents = [
    ...images.map(({ base64, mediaType }) => ({ inlineData: { mimeType: mediaType, data: base64 } })),
    { text: prompt },
  ];

  try {
    if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: buildSemanticSchema(categoryOptions),
        thinkingConfig: { thinkingLevel: "low" },
        maxOutputTokens: 1800,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const normalized = normalizeSemanticResult(parsed, categoryOptions);
    return {
      enabled: true,
      provider: "gemini",
      model,
      fields: normalized.fields,
      suggestedCategory: normalized.suggestedCategory,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    console.error("[ocr:gemini-semantic]", error);
    return {
      enabled: false,
      provider: "gemini",
      model,
      reason: error?.message || "Gemini semantic interpretation failed.",
    };
  }
}
