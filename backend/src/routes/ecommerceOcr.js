import express from "express";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

function isPrivateHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host.endsWith(".local") || host === "::1" || host === "0.0.0.0" ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

router.post("/images", async (req, res) => {
  try {
    const imageUrls = Array.isArray(req.body?.imageUrls) ? req.body.imageUrls.slice(0, 6) : [];
    if (!imageUrls.length) return res.status(400).json({ error: "At least one public product image URL is required." });

    const formData = new FormData();
    let added = 0;
    for (const rawValue of imageUrls) {
      try {
        const imageUrl = new URL(String(rawValue || ""));
        if (!["http:", "https:"].includes(imageUrl.protocol) || isPrivateHost(imageUrl.hostname)) continue;
        const response = await fetch(imageUrl.href, {
          headers: {
            "user-agent": "PARAKH Compliance Inspection/1.0",
            accept: "image/jpeg,image/png,image/webp,image/*",
          },
          signal: AbortSignal.timeout(10000),
        });
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.startsWith("image/")) continue;
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > 12 * 1024 * 1024) continue;
        formData.append("images", new Blob([buffer], { type: contentType }), `ecommerce-${added + 1}.jpg`);
        added += 1;
      } catch {}
    }

    if (!added) return res.status(422).json({ error: "No downloadable public product images were available for OCR." });

    const baseUrl = String(process.env.INTERNAL_BASE_URL || `http://127.0.0.1:${Number(process.env.PORT || 5000)}`).replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/api/ocr/analyze`, {
      method: "POST",
      body: formData,
      headers: req.headers.authorization ? { authorization: req.headers.authorization } : {},
      signal: AbortSignal.timeout(45000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || data?.error || "Shared OCR engine failed." });

    res.json({
      result: data.result || null,
      provider: data.provider || "local-rules",
      model: data.model || "local declaration mapper",
      semantic: data.semantic || data.result?.semantic || null,
      detectionProvider: data.detectionProvider || "paddleocr",
      detectionProviders: data.detectionProviders || ["paddleocr"],
      fallbackReason: data.fallbackReason || null,
      engine: "parakh-fast-ocr",
      imageCount: added,
    });
  } catch (error) {
    console.error("[ecommerce:ocr]", error);
    res.status(error?.name === "TimeoutError" ? 504 : 502).json({ error: error?.message || "E-commerce image OCR failed." });
  }
});

export default router;
