import {
  buildSemanticPrompt,
  normalizeSemanticResult,
  parseJsonContent,
} from "./semanticPackageCommon.js";

function normalizeContent(content) {
  if (Array.isArray(content)) {
    return content.filter((item) => item?.type === "text").map((item) => item.text).join("\n");
  }
  return content;
}

export async function interpretPackageWithMistral({ images = [], detections = [], rawText = "", categoryOptions = [], signal } = {}) {
  const apiKey = process.env.MISTRAL_API_KEY || "";
  if (!apiKey) {
    return { enabled: false, provider: "mistral", reason: "MISTRAL_API_KEY is not configured." };
  }

  const model = process.env.MISTRAL_SEMANTIC_MODEL || "mistral-small-latest";
  const prompt = buildSemanticPrompt({ detections, rawText, categoryOptions });
  const content = [
    { type: "text", text: prompt },
    ...images.map(({ base64, mediaType }) => ({
      type: "image_url",
      image_url: `data:${mediaType};base64,${base64}`,
    })),
  ];

  try {
    if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4096,
      }),
      signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || data?.error?.message || `Mistral failed (${response.status}).`);
    }

    const messageContent = normalizeContent(data?.choices?.[0]?.message?.content);
    const parsed = parseJsonContent(messageContent);
    const normalized = normalizeSemanticResult(parsed, categoryOptions);
    return {
      enabled: true,
      provider: "mistral",
      model,
      fields: normalized.fields,
      suggestedCategory: normalized.suggestedCategory,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    console.error("[ocr:mistral-semantic]", error);
    return {
      enabled: false,
      provider: "mistral",
      model,
      reason: error?.message || "Mistral semantic interpretation failed.",
    };
  }
}
