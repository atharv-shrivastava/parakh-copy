import sharp from "sharp";
import {
  buildSemanticPrompt,
  normalizeSemanticResult,
  parseJsonContent,
} from "./semanticPackageCommon.js";

async function buildContactSheet(images) {
  if (!images.length) return null;
  const width = 1400;
  const rendered = [];
  let totalHeight = 0;
  for (const image of images) {
    const buffer = Buffer.from(image.base64, "base64");
    const output = await sharp(buffer, { failOn: "none" })
      .resize({ width, height: width, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    const meta = await sharp(output).metadata();
    const height = Number(meta.height || 1);
    rendered.push({ input: output, top: totalHeight });
    totalHeight += height + 24;
  }
  const sheet = await sharp({
    create: {
      width,
      height: Math.max(1, totalHeight),
      channels: 3,
      background: { r: 245, g: 245, b: 245 },
    },
  })
    .composite(rendered)
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toBuffer();
  return `data:image/jpeg;base64,${sheet.toString("base64")}`;
}

export async function interpretPackageWithCloudflare({ images = [], detections = [], rawText = "", categoryOptions = [], signal } = {}) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN || process.env.CLOUDFLARE_API_KEY || "";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  if (!apiToken || !accountId) {
    return {
      enabled: false,
      provider: "cloudflare",
      model: process.env.CLOUDFLARE_SEMANTIC_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct",
      reason: "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.",
    };
  }

  const model = process.env.CLOUDFLARE_SEMANTIC_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";
  if (!images.length) {
    return { enabled: false, provider: "cloudflare", model, reason: "No package images supplied." };
  }

  try {
    const image = await buildContactSheet(images);
    const prompt = buildSemanticPrompt({ detections, rawText, categoryOptions });
    if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Return only valid JSON matching the requested package-field structure. Do not add commentary." },
            { role: "user", content: prompt },
          ],
          image,
          max_tokens: 4096,
          temperature: 0.1,
        }),
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

    const content = data?.result?.response ?? data?.result?.content ?? data?.result?.text ?? data?.response;
    const parsed = parseJsonContent(content);
    const normalized = normalizeSemanticResult(parsed, categoryOptions);
    return {
      enabled: true,
      provider: "cloudflare",
      model,
      fields: normalized.fields,
      suggestedCategory: normalized.suggestedCategory,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    console.error("[ocr:cloudflare-semantic]", error);
    return {
      enabled: false,
      provider: "cloudflare",
      model,
      reason: error?.message || "Cloudflare semantic interpretation failed.",
    };
  }
}
