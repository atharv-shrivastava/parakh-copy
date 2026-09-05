import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../middleware/auth.js";
import { getOcrConfig } from "./config.js";
import { interpretOcrFields } from "./ocrFieldInterpreter.js";
import { interpretPackageWithGemini } from "./geminiPackageInterpreter.js";

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
  return mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
}

function optionalTimeoutSignal(envName) {
  const timeoutMs = Number(process.env[envName] || "0");
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function rawTextEvidence(rawText, imageIndex = 0) {
  return String(rawText || "")
    .split(/\r?\n/)
    .map(normalizeText)
    .filter(Boolean)
    .map((text, index) => ({
      id: `raw:${imageIndex}:${index}`,
      imageIndex,
      text,
      confidence: 0.55,
      boundingBox: null,
    }));
}

async function analyzeOneWithPaddle(image, imageIndex) {
  const formData = new FormData();
  const bytes = Buffer.from(image.base64, "base64");
  formData.append(
    "images",
    new Blob([bytes], { type: image.mediaType }),
    `parakh-${imageIndex + 1}.${extension(image.mediaType)}`,
  );

  const paddleUrl = process.env.PADDLE_OCR_URL || "http://localhost:8081";
  const signal = optionalTimeoutSignal("OCR_PADDLE_SINGLE_TIMEOUT_MS");
  const response = await fetch(`${paddleUrl}/api/ocr/analyze`, {
    method: "POST",
    body: formData,
    ...(signal ? { signal } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(
      new Error(data?.error || data?.message || data?.detail || `PaddleOCR failed (${response.status}).`),
      { code: "OCR_PADDLE_ERROR", statusCode: 502 },
    );
  }

  const detections = Array.isArray(data?.result?.declarationEvidence)
    ? data.result.declarationEvidence
      .map((item, index) => ({
        id: String(item?.id ?? `paddle-${imageIndex}:${index}`),
        imageIndex,
        text: normalizeText(item?.text),
        confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
        boundingBox: item?.boundingBox || null,
      }))
      .filter((item) => item.text)
    : [];
  const rawText = normalizeText(data?.result?.rawText) || detections.map((item) => item.text).join("\n");
  return {
    imageIndex,
    rawText,
    evidence: [...detections, ...rawTextEvidence(rawText, imageIndex)],
  };
}

async function analyzeWithPaddle(images) {
  const concurrency = Math.max(1, Math.min(Number(process.env.OCR_PADDLE_CONCURRENCY || "2"), images.length));
  const results = [];
  for (let start = 0; start < images.length; start += concurrency) {
    const batch = images.slice(start, start + concurrency);
    const batchResults = await Promise.all(batch.map((image, offset) => analyzeOneWithPaddle(image, start + offset)));
    results.push(...batchResults);
  }
  results.sort((a, b) => a.imageIndex - b.imageIndex);
  return {
    provider: "paddleocr",
    model: "PaddleOCR",
    rawText: results.map((item) => item.rawText).filter(Boolean).join("\n"),
    evidence: results.flatMap((item) => item.evidence),
  };
}

function normalizeField(field) {
  if (!field || typeof field !== "object") {
    return { value: null, raw: null, confidence: 0, evidence: null, status: "absent" };
  }
  const rawStatus = String(field.status || "").toLowerCase();
  const status = rawStatus === "not_detected"
    ? "absent"
    : rawStatus === "referenced_inner_pack"
      ? "ambiguous"
      : ["found", "absent", "unreadable", "ambiguous"].includes(rawStatus)
        ? rawStatus
        : field.value != null ? "found" : "absent";
  return {
    value: field.value ?? null,
    raw: field.raw ?? field.evidence ?? null,
    confidence: Math.max(0, Math.min(1, Number(field.confidence) || 0)),
    evidence: field.evidence ?? field.raw ?? null,
    status,
    ...(field.imageIndex != null ? { imageIndex: Number(field.imageIndex) } : {}),
  };
}

function aiFieldUsable(field) {
  return field && typeof field === "object" && field.status === "found" && field.value != null && String(field.value).trim() !== "";
}

function mergeSemanticFields(deterministicFields, aiFields) {
  const merged = {};
  const keys = new Set([...Object.keys(deterministicFields || {}), ...Object.keys(aiFields || {})]);
  for (const key of keys) {
    const local = normalizeField(deterministicFields?.[key]);
    const ai = aiFields?.[key];
    const aiConfidence = Number(ai?.confidence || 0);
    const localConfidence = Number(local?.confidence || 0);
    if (aiFieldUsable(ai) && (
      local.status === "absent" ||
      local.status === "unreadable" ||
      local.status === "ambiguous" ||
      localConfidence < 0.65 && aiConfidence >= localConfidence + 0.12
    )) {
      merged[key] = {
        value: ai.value,
        raw: ai.raw || ai.value,
        confidence: aiConfidence,
        evidence: ai.evidence || ai.raw || ai.value,
        status: ai.status,
        ...(Number.isInteger(ai.imageIndex) ? { imageIndex: ai.imageIndex } : {}),
        source: "GEMINI_SEMANTIC_ASSIST",
        deterministicFallback: local.value ?? null,
      };
    } else {
      merged[key] = local;
    }
  }
  return merged;
}

function buildStructuredResult(paddle, aiSemantic = null) {
  const reconciliation = interpretOcrFields({
    detections: paddle.evidence,
    rawText: paddle.rawText,
  });

  const fields = mergeSemanticFields(reconciliation?.fields || {}, aiSemantic?.fields || {});
  const result = {};
  for (const key of [
    "productName", "brandName", "manufacturer", "manufacturerAddress", "packer", "packerAddress",
    "marketer", "marketerAddress", "importer", "importerAddress", "netQuantity", "unit", "mrp",
    "currency", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "batchNumber",
    "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode",
  ]) {
    result[key] = normalizeField(fields[key]);
  }

  const declarationEvidence = paddle.evidence
    .filter((item) => item.text)
    .map((item, index) => ({
      id: String(item.id || `paddle-evidence-${index}`),
      imageIndex: Number(item.imageIndex || 0) + 1,
      type: "OCR_TEXT",
      text: item.text,
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.55)),
      boundingBox: item.boundingBox || null,
    }));

  const warnings = [];
  if (reconciliation?.metadata?.innerPackReference) {
    warnings.push("Package text refers to an individual/inner pack for additional batch, date, price, or related details.");
  }
  if (!aiSemantic?.enabled) {
    warnings.push("AI semantic assist unavailable; using local deterministic field mapping only.");
  }

  const needsReview = Object.values(result).some((field) =>
    field?.status === "unreadable" || field?.status === "ambiguous" ||
    (field?.status === "found" && Number(field.confidence || 0) < 0.6),
  );

  return {
    ...result,
    otherDeclarations: declarationEvidence.map((item) => item.text),
    declarationEvidence,
    rawText: paddle.rawText,
    warnings,
    unreadableFields: Object.entries(result).filter(([, field]) => field?.status === "unreadable").map(([key]) => key),
    needsReview,
    semanticReconciliation: reconciliation?.metadata || null,
    candidateEvidence: reconciliation?.candidateEvidence || {},
    aiSemantic: aiSemantic?.enabled ? {
      provider: aiSemantic.provider,
      model: aiSemantic.model,
    } : null,
  };
}

async function readImages(files) {
  return Promise.all(files.map(async (file) => ({
    base64: (await fs.readFile(file.path)).toString("base64"),
    mediaType: file.mimetype,
  })));
}

async function handleFastAnalyze(req, res, files) {
  const startedAt = Date.now();
  try {
    if (!files.length) {
      return res.status(400).json({ error: { code: "OCR_NO_IMAGES", message: "Upload at least one package image." } });
    }

    const images = await readImages(files);
    let categoryOptions = [];
    try {
      categoryOptions = JSON.parse(req.body?.categoryOptions || "[]");
      if (!Array.isArray(categoryOptions)) categoryOptions = [];
    } catch {
      categoryOptions = [];
    }

    const uploadMs = Date.now() - startedAt;
    const parallelStartedAt = Date.now();
    const [paddle, aiSemantic] = await Promise.all([
      analyzeWithPaddle(images),
      interpretPackageWithGemini({
        images,
        categoryOptions,
      }),
    ]);
    const parallelMs = Date.now() - parallelStartedAt;
    const paddleMs = null;
    const aiMs = null;

    const result = buildStructuredResult(paddle, aiSemantic);
    const totalMs = Date.now() - startedAt;

    console.log(`[ocr:fast] images=${files.length} evidence=${paddle.evidence.length} parallel=${parallelMs}ms total=${totalMs}ms aiEnabled=${Boolean(aiSemantic.enabled)}`);

    res.json({
      result,
      provider: "paddleocr",
      model: "PaddleOCR",
      detectionProvider: "paddleocr",
      detectionProviders: ["paddleocr"],
      rawText: paddle.rawText,
      semantic: aiSemantic?.enabled ? {
        provider: aiSemantic.provider,
        model: aiSemantic.model,
        enabled: true,
      } : null,
      aiSuggestedCategory: aiSemantic?.suggestedCategory || null,
      aiSemanticEnabled: Boolean(aiSemantic?.enabled),
      aiSemanticError: aiSemantic?.enabled ? null : aiSemantic?.reason || null,
      timing: { uploadMs, parallelMs, paddleMs, aiMs, totalMs },
      fallbackReason: result.warnings?.find((item) => item.includes("AI semantic assist unavailable")) || null,
    });
  } catch (error) {
    console.error("[ocr:fast]", error);
    const status = error.statusCode || 502;
    res.status(status).json({
      error: {
        code: error.code || "OCR_FAST_ERROR",
        message: error.message || "Fast OCR analysis failed.",
      },
    });
  } finally {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
  }
}

router.post("/analyze", authenticate, upload.array("images", config.maxImages), (req, res) =>
  handleFastAnalyze(req, res, req.files || []));

export default router;
