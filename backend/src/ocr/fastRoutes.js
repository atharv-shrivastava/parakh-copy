import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../middleware/auth.js";
import { getOcrConfig } from "./config.js";
import { runSemanticMapper } from "./localSemanticMapper.js";

const router = express.Router();
const config = getOcrConfig();
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const storage = multer.diskStorage({ destination: (_req, _file, cb) => cb(null, config.tempDir), filename: (_req, file, cb) => cb(null, `parakh-fast-ocr-${crypto.randomUUID()}${path.extname(file.originalname)}`) });
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => allowedTypes.has(file.mimetype) ? cb(null, true) : cb(Object.assign(new Error("Only JPEG, PNG and WebP images are supported."), { code: "OCR_UNSUPPORTED_FORMAT", statusCode: 415 })),
  limits: { files: config.maxImages, fileSize: config.maxImageSizeBytes },
});

function extension(mediaType) { return mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg"; }

function rawTextEvidence(rawText, startIndex = 0) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const evidence = lines.map((text, index) => ({
    id: `raw:${index}`,
    imageIndex: 0,
    text,
    confidence: 0.55,
    boundingBox: null,
  }));

  const contextualPatterns = [
    { re: /^(?:mfd\.?|mfg\.?|manufactured)\s+by\s*:?$/i, type: "MANUFACTURER" },
    { re: /^(?:packed|pkd)\s+by\s*:?$/i, type: "PACKER" },
    { re: /^marketed\s+by\s*:?$/i, type: "MARKETER" },
    { re: /^imported\s+by\s*:?$/i, type: "IMPORTER" },
  ];

  contextualPatterns.forEach(({ re, type }) => {
    lines.forEach((line, index) => {
      if (!re.test(line)) return;
      for (let offset = 1; offset <= 3; offset += 1) {
        const next = lines[index + offset];
        if (!next) break;
        if (/^(?:for|visit us|toll free|e-?mail|made in|store in|for sale|mfg\.? lic\.?|lic\.|www\.)/i.test(next)) break;
        if (/^\(?[A-Z]\)?\s+/.test(next) || /\b(?:limited|ltd|private|foods|ayurved|herbal|industries|division|centre|centre)\b/i.test(next) || next.length >= 6) {
          evidence.push({
            id: `raw-context:${type}:${index}:${offset}`,
            imageIndex: 0,
            text: `${line} ${next}`,
            confidence: 0.62,
            boundingBox: null,
          });
          break;
        }
      }
    });
  });

  return evidence.slice(startIndex);
}

async function analyzeWithPaddle(images) {
  const formData = new FormData();
  images.forEach((image, index) => {
    const bytes = Buffer.from(image.base64, "base64");
    formData.append("images", new Blob([bytes], { type: image.mediaType }), `parakh-${index + 1}.${extension(image.mediaType)}`);
  });
  const paddleUrl = process.env.PADDLE_OCR_URL || "http://localhost:8081";
  const response = await fetch(`${paddleUrl}/api/ocr/analyze`, { method: "POST", body: formData, signal: AbortSignal.timeout(Number(process.env.OCR_PADDLE_TIMEOUT_MS || "30000")) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || data?.detail || `PaddleOCR failed (${response.status}).`);
  const rawEvidence = Array.isArray(data?.result?.declarationEvidence) ? data.result.declarationEvidence : [];
  const evidence = rawEvidence.map((item, index) => ({ id: String(item?.id ?? `paddle-${Math.max(0, Number(item?.imageIndex || 1) - 1)}:${index}`), imageIndex: Math.max(0, Number(item?.imageIndex || 1) - 1), text: String(item?.text || "").trim(), confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)), boundingBox: item?.boundingBox || null })).filter((item) => item.text);
  const rawText = String(data?.result?.rawText || evidence.map((item) => item.text).join("\n"));
  const missingRawCandidates = rawTextEvidence(rawText);
  const mergedEvidence = [...evidence, ...missingRawCandidates];
  return { provider: "paddleocr", model: data?.model || "PaddleOCR", rawText, evidence: mergedEvidence };
}

async function readImages(files) {
  return Promise.all(files.map(async (file) => ({ base64: (await fs.readFile(file.path)).toString("base64"), mediaType: file.mimetype })));
}

async function handleFastAnalyze(_req, res, files) {
  const startedAt = Date.now();
  try {
    if (!files.length) return res.status(400).json({ error: { code: "OCR_NO_IMAGES", message: "Upload at least one package image." } });
    const images = await readImages(files);
    const uploadMs = Date.now() - startedAt;
    const paddleStartedAt = Date.now();
    const paddle = await analyzeWithPaddle(images);
    const paddleMs = Date.now() - paddleStartedAt;
    const semanticStartedAt = Date.now();
    const semantic = await runSemanticMapper(paddle.evidence, config);
    const semanticMs = Date.now() - semanticStartedAt;
    console.log(`[ocr:fast] images=${files.length} evidence=${paddle.evidence.length} upload=${uploadMs}ms paddle=${paddleMs}ms semantic=${semanticMs}ms total=${Date.now() - startedAt}ms`);
    res.json({
      result: semantic,
      provider: semantic?.semantic?.provider || "local-rules",
      model: semantic?.semantic?.provider === "gliner2-local" ? "fastino/gliner2-base-v1" : "local rules",
      detectionProvider: "paddleocr",
      detectionProviders: ["paddleocr"],
      rawText: paddle.rawText,
      semantic: semantic?.semantic || null,
      fallbackReason: null,
    });
  } catch (error) {
    console.error("[ocr:fast]", error);
    const status = error.statusCode || 502;
    res.status(status).json({ error: { code: error.code || "OCR_FAST_ERROR", message: error.message || "Fast OCR analysis failed." } });
  } finally {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
  }
}

router.post("/analyze", authenticate, upload.array("images", config.maxImages), (req, res) => handleFastAnalyze(req, res, req.files || []));
export default router;
