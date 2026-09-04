import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../middleware/auth.js";
import { getOcrConfig } from "./config.js";
import { runSemanticMapper } from "./localSemanticMapper.js";
import { interpretPackage } from "./aiSemanticInterpreter.js";

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

function rawTextEvidence(rawText) {
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
      for (let offset = 1; offset <= 6; offset += 1) {
        const next = lines[index + offset];
        if (!next) break;
        if (/^(?:for|visit us|toll free|e-?mail|made in|store in|for sale|mfg\.? lic\.?|lic\.|www\.)/i.test(next)) break;
        const looksLikeGarbage = /^(?:[0-9]{1,3}|[#*]+|[A-Z]{1,3})$/.test(next);
        if (looksLikeGarbage) continue;
        const looksLikeCompany = /\b(?:limited|ltd|private|foods|food|ayurved|herbal|industr(?:y|ies)|division|park|company|pvt)\b/i.test(next);
        const looksLikeLabeledValue = /^\(?[A-Z]\)?[.)]?\s+.{5,}/.test(next);
        if (looksLikeCompany || looksLikeLabeledValue || next.length >= 8) {
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

  return evidence;
}

function mergeHeuristicFields(semantic, heuristic) {
  const next = { ...semantic };
  const fieldKeys = [
    "productName", "brandName", "mrp", "netQuantity", "unit", "manufacturer", "manufacturerAddress",
    "marketer", "packer", "importer", "batchNumber", "dateOfManufacture", "dateOfPacking", "bestBefore",
    "expiryDate", "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode",
  ];

  for (const key of fieldKeys) {
    const current = next[key];
    const candidate = heuristic?.[key];
    if (!candidate?.value) continue;
    const currentMissing = !current || current.status !== "found" || !current.value;
    const heuristicUseful = Number(candidate.confidence || 0) >= 0.55;
    if (!currentMissing || !heuristicUseful) continue;
    next[key] = {
      ...candidate,
      source: "SEMANTIC_HEURISTIC",
      imageIndex: current?.imageIndex,
    };
  }

  const existingEvidence = Array.isArray(next.declarationEvidence) ? next.declarationEvidence : [];
  const heuristicEvidence = [
    ["PRODUCT_NAME", heuristic?.productName], ["BRAND", heuristic?.brandName], ["MRP", heuristic?.mrp], ["NET_QUANTITY", heuristic?.netQuantity],
    ["MANUFACTURER", heuristic?.manufacturer], ["MARKETER", heuristic?.marketer], ["PACKER", heuristic?.packer], ["IMPORTER", heuristic?.importer],
    ["COUNTRY_OF_ORIGIN", heuristic?.countryOfOrigin], ["CONSUMER_CARE", heuristic?.consumerCarePhone], ["FSSAI_LICENSE", heuristic?.fssaiLicenseNumber], ["BARCODE", heuristic?.barcode],
  ];
  for (const [type, item] of heuristicEvidence) {
    if (!item?.value) continue;
    const exists = existingEvidence.some((entry) => entry.type === type && String(entry.text || "").toLowerCase() === String(item.evidence || item.value).toLowerCase());
    if (!exists) existingEvidence.push({ imageIndex: 1, type, text: String(item.evidence || item.value), confidence: Number(item.confidence || 0.55), boundingBox: null, source: "SEMANTIC_HEURISTIC" });
  }
  next.declarationEvidence = existingEvidence;
  return next;
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
  const mergedEvidence = [...evidence, ...rawTextEvidence(rawText)];
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
    const heuristic = interpretPackage({ ocrText: paddle.rawText, detections: paddle.evidence });
    const heuristicMs = Date.now() - semanticStartedAt;
    const localStartedAt = Date.now();
    const semantic = await runSemanticMapper(paddle.evidence, config);
    const localMs = Date.now() - localStartedAt;
    const merged = mergeHeuristicFields(semantic, heuristic);
    const totalMs = Date.now() - startedAt;
    console.log(`[ocr:fast] images=${files.length} evidence=${paddle.evidence.length} upload=${uploadMs}ms paddle=${paddleMs}ms heuristic=${heuristicMs}ms semantic=${localMs}ms total=${totalMs}ms`);
    res.json({
      result: merged,
      provider: merged?.semantic?.provider || "local-rules",
      model: merged?.semantic?.provider === "gliner2-local" ? "fastino/gliner2-base-v1" : "local rules",
      detectionProvider: "paddleocr",
      detectionProviders: ["paddleocr"],
      rawText: paddle.rawText,
      semantic: merged?.semantic || null,
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
