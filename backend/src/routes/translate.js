import express from "express";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const fenced = String(text || "").match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const start = String(text || "").indexOf("{");
  const end = String(text || "").lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(String(text).slice(start, end + 1)); } catch {}
  }
  return null;
}

router.use(authenticate);

router.post("/", async (req, res) => {
  const target = String(req.body?.target || "en").trim().toLowerCase();
  const texts = Array.isArray(req.body?.texts)
    ? req.body.texts.map((value) => String(value ?? "").trim()).filter(Boolean).slice(0, 60)
    : [];
  if (!texts.length || target === "en") return res.json({ translations: Object.fromEntries(texts.map((text) => [text, text])) });

  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN || process.env.CLOUDFLARE_API_KEY || "";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  const model = process.env.CLOUDFLARE_TRANSLATION_MODEL || process.env.CLOUDFLARE_SEMANTIC_MODEL || "@cf/google/gemma-4-26b-a4b-it";
  if (!apiToken || !accountId) return res.json({ translations: Object.fromEntries(texts.map((text) => [text, text])), fallback: true, reason: "Cloudflare translation is not configured." });

  try {
    const payload = {
      targetLanguage: target,
      instructions: "Translate each text from its detected source language into the target language. Preserve brand names, registered names, numbers, units, codes, phone numbers, email addresses, URLs and legal rule identifiers unless they genuinely need translation. Do not summarize, explain or omit anything. Return strict JSON only in the form {\"translations\":{\"original text\":\"translated text\"}}.",
      texts,
    };
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: payload.instructions },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
        chat_template_kwargs: { enable_thinking: false },
        max_tokens: Math.min(5000, Math.max(900, texts.length * 55)),
        temperature: 0,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) throw new Error(data?.errors?.map((item) => item?.message).filter(Boolean).join("; ") || `Translation failed (${response.status}).`);
    const content = data?.result?.response?.choices?.[0]?.message?.content
      ?? data?.result?.choices?.[0]?.message?.content
      ?? data?.result?.response
      ?? data?.result?.content
      ?? data?.response;
    const parsed = parseJson(content);
    const incoming = parsed?.translations && typeof parsed.translations === "object" ? parsed.translations : {};
    const translations = Object.fromEntries(texts.map((text) => [text, String(incoming[text] ?? text)]));
    res.json({ translations, model });
  } catch (error) {
    console.error("[translate]", error);
    res.json({ translations: Object.fromEntries(texts.map((text) => [text, text])), fallback: true, reason: error?.message || "Translation failed." });
  }
});

export default router;
