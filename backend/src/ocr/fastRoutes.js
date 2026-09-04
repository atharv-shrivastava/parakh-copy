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

function rawTextEvidence(rawText, imageIndex = 0) {
  const lines = String(rawText || "").split(/\r?\n/).map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
  const evidence = lines.map((text, index) => ({ id: `raw:${imageIndex}:${index}`, imageIndex, text, confidence: 0.55, boundingBox: null }));
  const contextualPatterns = [
    { re: /^(?:mfd\.?|mfg\.?|manufactured)\s+by\s*:?$/i, type: "MANUFACTURER" },
    { re: /^(?:packed|pkd)\s+by\s*:?$/i, type: "PACKER" },
    { re: /^marketed\s+by\s*:?$/i, type: "MARKETER" },
    { re: /^imported\s+by\s*:?$/i, type: "IMPORTER" },
    { re: /^(?:m\.?r\.?p\.?|maximum\s+retail\s+price)\s*[:\-]?$/i, type: "MRP" },
  ];
  contextualPatterns.forEach(({ re, type }) => {
    lines.forEach((line, index) => {
      if (!re.test(line)) return;
      for (let offset = 1; offset <= 6; offset += 1) {
        const next = lines[index + offset];
        if (!next) break;
        if (/^(?:for|visit us|toll free|e-?mail|made in|store in|for sale|mfg\.? lic\.?|lic\.|www\.)/i.test(next)) break;
        if (/^(?:[0-9]{1,3}|[#*]+|[A-Z]{1,3})$/.test(next)) continue;
        if (type === "MRP" && !/(?:₹|rs\.?|inr)?\s*\d{1,6}(?:[.,]\d{1,2})?/i.test(next)) continue;
        const looksLikeCompany = /\b(?:limited|ltd|private|foods|food|ayurved|herbal|industr(?:y|ies)|division|park|company|pvt)\b/i.test(next);
        const looksLikeLabeledValue = /^\(?[A-Z]\)?[.)]?\s+.{5,}/.test(next);
        if (type === "MRP" || looksLikeCompany || looksLikeLabeledValue || next.length >= 8) {
          evidence.push({ id: `raw-context:${imageIndex}:${type}:${index}:${offset}`, imageIndex, text: `${line} ${next}`, confidence: type === "MRP" ? 0.8 : 0.62, boundingBox: null });
          break;
        }
      }
    });
  });
  return evidence;
}

async function analyzeOneWithPaddle(image, imageIndex) {
  const formData = new FormData();
  const bytes = Buffer.from(image.base64, "base64");
  formData.append("images", new Blob([bytes], { type: image.mediaType }), `parakh-${imageIndex + 1}.${extension(image.mediaType)}`);
  const paddleUrl = process.env.PADDLE_OCR_URL || "http://localhost:8081";
  const timeoutMs = Number(process.env.OCR_PADDLE_SINGLE_TIMEOUT_MS || "15000");
  const response = await fetch(`${paddleUrl}/api/ocr/analyze`, { method: "POST", body: formData, signal: AbortSignal.timeout(timeoutMs) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error || data?.message || data?.detail || `PaddleOCR failed (${response.status}).`), { code: "OCR_PADDLE_ERROR", statusCode: 502 });
  const rawEvidence = Array.isArray(data?.result?.declarationEvidence) ? data.result.declarationEvidence : [];
  const evidence = rawEvidence.map((item, index) => ({ id: String(item?.id ?? `paddle-${imageIndex}:${index}`), imageIndex, text: String(item?.text || "").trim(), confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)), boundingBox: item?.boundingBox || null })).filter((item) => item.text);
  const rawText = String(data?.result?.rawText || evidence.map((item) => item.text).join("\n"));
  return { imageIndex, rawText, evidence: [...evidence, ...rawTextEvidence(rawText, imageIndex)] };
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
  return { provider: "paddleocr", model: "PaddleOCR", rawText: results.map((item) => item.rawText).filter(Boolean).join("\n"), evidence: results.flatMap((item) => item.evidence) };
}

function sanitizeSemanticResult(result) {
  const next = { ...result };
  const invalidValuePatterns = [
    /^for\s+batch\s+no\b.*(?:refer|details|inside)/i,
    /^for\s+mfg\.?\s+unit\s+address\b/i,
    /^for\s+consumer\s+care\s+contact\b/i,
    /^for\s+batch\s+no\b/i,
  ];
  const labelOnlyPatterns = [
    /^(?:mfd\.?|mfg\.?|manufactured)\s+by\s*:?[\s]*$/i,
    /^(?:packed|pkd)\s+by\s*:?[\s]*$/i,
    /^marketed\s+by\s*:?[\s]*$/i,
    /^imported\s+by\s*:?[\s]*$/i,
    /^(?:consumer|customer)\s+care(?:\s+contact)?\s*:?[\s]*$/i,
  ];
  const fieldsToValidate = ["manufacturer", "manufacturerAddress", "marketer", "packer", "importer", "expiryDate", "bestBefore", "batchNumber", "consumerCarePhone", "consumerCareEmail", "fssaiLicenseNumber", "mrp"];
  for (const key of fieldsToValidate) {
    const field = next[key];
    const value = String(field?.value ?? "").trim();
    const raw = String(field?.raw ?? field?.evidence ?? "").trim();
    if (!field || field.status !== "found") continue;
    if (!value || labelOnlyPatterns.some((re) => re.test(value)) || invalidValuePatterns.some((re) => re.test(value))) next[key] = { ...field, value: null, raw: raw || value, status: "absent", confidence: 0, evidence: raw || null };
  }
  if (next.mrp?.status === "found") {
    const raw = String(next.mrp.value ?? next.mrp.raw ?? next.mrp.evidence ?? "");
    const match = raw.match(/(?:₹|rs\.?|inr|mrp|maximum\s+retail\s+price)\s*[:\-]?\s*(\d{1,6}(?:[.,]\d{1,2})?)/i);
    if (match) next.mrp = { ...next.mrp, value: Number(match[1].replace(/,/g, "")) };
    else if (!/\bmrp\b|maximum\s+retail\s+price|₹|\brs\.?\b|\binr\b/i.test(raw)) next.mrp = { ...next.mrp, value: null, status: "absent", confidence: 0 };
  }
  const declarations = Array.isArray(next.otherDeclarations) ? next.otherDeclarations : [];
  next.otherDeclarations = declarations.map((item) => typeof item === "string" ? item : item?.text).map((item) => String(item || "").trim()).filter(Boolean);
  next.declarationEvidence = Array.isArray(next.declarationEvidence) ? next.declarationEvidence.map((item) => ({ ...item, text: String(item?.text || "").trim() })).filter((item) => item.text) : [];
  return next;
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
    const originalGlinerFlag = process.env.GLINER_SEMANTIC_ENABLED;
    if (originalGlinerFlag === undefined) process.env.GLINER_SEMANTIC_ENABLED = "false";
    let semantic;
    try { semantic = await runSemanticMapper(paddle.evidence, config); }
    finally { if (originalGlinerFlag === undefined) delete process.env.GLINER_SEMANTIC_ENABLED; }
    const localMs = Date.now() - localStartedAt;
    const sanitized = sanitizeSemanticResult(semantic);
    const merged = { ...sanitized };
    for (const [key, value] of Object.entries(heuristic)) {
      if (["declarationEvidence", "otherDeclarations", "rawText", "warnings", "semanticMetadata"].includes(key)) continue;
      const existing = merged[key];
      const candidateConfidence = Number(value?.confidence || 0);
      const existingConfidence = Number(existing?.confidence || 0);
      const identityField = key === "productName" || key === "brandName";
      const shouldFill = (!existing || existing.status !== "found" || !existing.value) && value?.status === "found" && value.value != null;
      const shouldUpgradeIdentity = identityField && value?.status === "found" && value.value != null && candidateConfidence > existingConfidence + 0.08;
      if (shouldFill || shouldUpgradeIdentity) merged[key] = { ...value, source: "SEMANTIC_HEURISTIC" };
    }
    const totalMs = Date.now() - startedAt;
    console.log(`[ocr:fast] images=${files.length} evidence=${paddle.evidence.length} upload=${uploadMs}ms paddle=${paddleMs}ms heuristic=${heuristicMs}ms semantic=${localMs}ms total=${totalMs}ms`);
    res.json({ result: merged, provider: merged?.semantic?.provider || "local-rules", model: merged?.semantic?.provider === "gliner2-local" ? "fastino/gliner2-base-v1" : "local rules", detectionProvider: "paddleocr", detectionProviders: ["paddleocr"], rawText: paddle.rawText, semantic: merged?.semantic || null, fallbackReason: null });
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
