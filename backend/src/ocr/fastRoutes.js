import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../middleware/auth.js";
import { getOcrConfig } from "./config.js";
import { runSemanticMapper } from "./semanticMapper.js";

const router = express.Router();
const config = getOcrConfig();
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.tempDir),
  filename: (_req, file, cb) => cb(null, `parakh-fast-ocr-${crypto.randomUUID()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => allowedTypes.has(file.mimetype)
    ? cb(null, true)
    : cb(Object.assign(new Error("Only JPEG, PNG and WebP images are supported."), { code: "OCR_UNSUPPORTED_FORMAT", statusCode: 415 })),
  limits: { files: config.maxImages, fileSize: config.maxImageSizeBytes },
});

function extension(mediaType) {
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/webp") return "webp";
  return "jpg";
}

async function analyzeWithPaddle(images) {
  const formData = new FormData();
  images.forEach((image, index) => {
    const bytes = Buffer.from(image.base64, "base64");
    formData.append("images", new Blob([bytes], { type: image.mediaType }), `parakh-${index + 1}.${extension(image.mediaType)}`);
  });

  const paddleUrl = process.env.PADDLE_OCR_URL || "http://localhost:8081";
  const response = await fetch(`${paddleUrl}/api/ocr/analyze`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(Number(process.env.OCR_PADDLE_TIMEOUT_MS || "30000")),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || data?.detail || `PaddleOCR failed (${response.status}).`);

  const rawEvidence = Array.isArray(data?.result?.declarationEvidence) ? data.result.declarationEvidence : [];
  const evidence = rawEvidence.map((item, index) => ({
    id: String(item?.id ?? `paddle-${Math.max(0, Number(item?.imageIndex || 1) - 1)}:${index}`),
    imageIndex: Math.max(0, Number(item?.imageIndex || 1) - 1),
    text: String(item?.text || "").trim(),
    confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
    boundingBox: item?.boundingBox || null,
  })).filter((item) => item.text);

  return {
    provider: "paddleocr",
    model: data?.model || "PaddleOCR",
    rawText: String(data?.result?.rawText || evidence.map((item) => item.text).join("\n")),
    evidence,
  };
}

async function readImages(files) {
  const images = [];
  for (const file of files) {
    const buffer = await fs.readFile(file.path);
    const mediaType = file.mimetype;
    images.push({ base64: buffer.toString("base64"), mediaType });
  }
  return images;
}

async function handleFastAnalyze(req, res, files) {
  try {
    if (!files.length) return res.status(400).json({ error: { code: "OCR_NO_IMAGES", message: "Upload at least one package image." } });

    const images = await readImages(files);
    const paddle = await analyzeWithPaddle(images);
    const semantic = await runSemanticMapper(paddle.evidence, config);

    res.json({
      result: semantic,
      provider: semantic?.semantic?.provider || "local",
      model: semantic?.semantic?.provider === "openai"
        ? config.openaiSemanticModel
        : semantic?.semantic?.provider === "gemini"
          ? config.geminiModel
          : "local declaration mapper",
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
