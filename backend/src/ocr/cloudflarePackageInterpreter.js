import sharp from "sharp";
import {
  buildSemanticPrompt,
  buildSemanticSchema,
  normalizeSemanticResult,
  parseJsonContent,
} from "./semanticPackageCommon.js";

async function buildContactSheet(images) {
  if (!images.length) return null;
  const width = 1000;
  const rendered = [];
  let totalHeight = 0;
  for (const image of images) {
    const buffer = Buffer.from(image.base64, "base64");
    const output = await sharp(buffer, { failOn: "none" })
      .resize({ width, height: width, fit: "inside", withoutEnlargement: false })
      .jpeg({ quality: 76, chromaSubsampling: "4:2:0" })
      .toBuffer();
    const meta = await sharp(output).metadata();
    const height = Number(meta.height || 1);
    rendered.push({ input: output, left: 0, top: totalHeight });
    totalHeight += height + 8;
  }
  const sheet = await sharp({
    create: {
      width,
      height: Math.max(1, totalHeight),
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(rendered)
    .jpeg({ quality: 76, chromaSubsampling: "4:2:0" })
    .toBuffer();
  return `data:image/jpeg;base64,${sheet.toString("base64")}`;
}

export async function interpretPackageWithCloudflare({
  images = [],
  detections = [],
  rawText = "",
  categoryOptions = [],
  signal,
  modelOverride = null,
  providerName = "cloudflare",
} = {}) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
    || process.env.CLOUDFLARE_AUTH_TOKEN
    || process.env.CLOUDFLARE_API_KEY
    || "";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  const model = modelOverride
    || process.env.CLOUDFLARE_SEMANTIC_MODEL
    || "@cf/google/gemma-4-26b-a4b-it";

  if (!apiToken || !accountId) {
    return { enabled: false, provider: providerName, model, reason: "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required." };
  }
  if (!images.length) {
    return { enabled: false, provider: providerName, model, reason: "No package images supplied." };
  }

  try {
    const image = await buildContactSheet(images);
    const prompt = buildSemanticPrompt({ detections, rawText, categoryOptions });
    if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");

    let body;
    if (model === "@cf/moondream/moondream3.1-9B-A2B") {
      body = {
        task: "query",
        image,
        question: `${prompt}\n\nReturn ONLY the JSON object. Do not include markdown fences or explanation.`,
        reasoning: false,
        temperature: 0,
        max_tokens: 1400,
      };
    } else {
      body = {
        messages: [
          { role: "system", content: "Return only valid JSON matching the requested package-field structure. Do not add commentary." },
          { role: "user", content: prompt },
        ],
        image,
        response_format: {
          type: "json_schema",
          json_schema: buildSemanticSchema(categoryOptions),
        },
        chat_template_kwargs: { enable_thinking: false },
        max_tokens: 1800,
        temperature: 0,
      };
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.errors?.map((item) => item?.message).filter(Boolean).join("; ")
          || data?.result?.error
          || `Cloudflare Workers AI failed (${response.status}).`,
      );
    }

    const content = data?.result?.response
      ?? data?.result?.content
      ?? data?.result?.text
      ?? data?.result?.answer
      ?? data?.response;
    const parsed = parseJsonContent(content);
    const normalized = normalizeSemanticResult(parsed, categoryOptions);
    return {
      enabled: true,
      provider: providerName,
      model,
      fields: normalized.fields,
      suggestedCategory: normalized.suggestedCategory,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    console.error(`[ocr:${providerName}-semantic]`, error);
    return {
      enabled: false,
      provider: providerName,
      model,
      reason: error?.message || "Cloudflare semantic interpretation failed.",
    };
  }
}
