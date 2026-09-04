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
        if (/^(?:for|visit us|toll free|e-?mail|made in|store in|for sale|mfg\.? lic\.?|lic\.)/i.test(next)) break;
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

function optionalTimeoutSignal(envName) {
  const timeoutMs = Number(process.env[envName] || "0");
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
}

async function analyzeOneWithPaddle(image, imageIndex) {
  const formData = new FormData();
  const bytes = Buffer.from(image.base64, "base64");
  formData.append("images", new Blob([bytes], { type: image.mediaType }), `parakh-${imageIndex + 1}.${extension(image.mediaType)}`);
  const paddleUrl = process.env.PADDLE_OCR_URL || "http://localhost:8081";
  const signal = optionalTimeoutSignal("OCR_PADDLE_SINGLE_TIMEOUT_MS");
  const response = await fetch(`${paddleUrl}/api/ocr/analyze`, { method: "POST", body: formData, ...(signal ? { signal } : {}) });
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

async function analyzeWithPaddleAndGliner(images) {
  const paddleStartedAt = Date.now();
  const paddle = await analyzeWithPaddle(images);
  const paddleMs = Date.now() - paddleStartedAt;
  const semanticStartedAt = Date.now();
  const heuristicStartedAt = Date.now();
  const [semantic, heuristic] = await Promise.all([
    runSemanticMapper(paddle.evidence, config).catch((error) => ({ error: error?.message || "GLiNER semantic mapping failed.", declarationEvidence: [], otherDeclarations: [], warnings: [error?.message || "GLiNER semantic mapping failed."] })),
    Promise.resolve(interpretPackage({ ocrText: paddle.rawText, detections: paddle.evidence })),
  ]);
  const semanticMs = Date.now() - semanticStartedAt;
  const heuristicMs = Date.now() - heuristicStartedAt;
  return { paddle, semantic, heuristic, paddleMs, semanticMs, heuristicMs };
}

const PROMOTIONAL_TEXT = /^(?:save|save\s+up\s+to|offer|special\s+offer|discount|free|buy\s+\d+|upto|up\s+to|limited\s+offer|new|introductory)\b|\b(?:save|discount|off)\s*\d+/i;
const IDENTITY_NOISE = /^(?:for|visit|toll|e-?mail|made\s+in|store\s+in|for\s+sale|marketed|manufactured|mfd|mfg|packed|pkd|imported|consumer|customer|country|address|ingredients?|nutrition|net|best|use|mrp|batch|barcode|license|manager|regd|registered|division|office)\b/i;
const CLAIM_TEXT = /\b(?:tightens?|fights?|gives?|protects?|prevents?|removes?|reduces?|controls?|treats?|helps?|improves?|strengthens?|whitens?|freshens?|cleans?|purifies?|repels?|restores?|supports?|boosts?|enhances?|long\s+life|healthy\s+gums?|fresh\s+breath)\b/i;
const INNER_PACK_REFERENCE = /\b(?:refer|see|check)\b.{0,80}\b(?:individual|inner|inside|pack)\b|\b(?:individual|inner)\s+pack\b.{0,80}\b(?:batch|mfg|manufactur|exp|expiry|mrp|price|details)\b/i;

function normalizeIdentityText(value) {
  return String(value || "").replace(/[\u00a0\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function identityTokenSimilarity(a, b) {
  const left = normalizeIdentityText(a).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const right = normalizeIdentityText(b).toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!left || !right) return 0;
  const rows = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
  }
  return 1 - rows[left.length][right.length] / Math.max(left.length, right.length);
}

function uniqueEvidenceLines(result, rawText) {
  const lines = [];
  const seen = new Set();
  const add = (text, confidence = 0.55, boundingBox = null) => {
    const value = normalizeIdentityText(text);
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push({ text: value, confidence: Number(confidence) || 0.55, boundingBox: boundingBox || null });
  };
  for (const item of Array.isArray(result?.declarationEvidence) ? result.declarationEvidence : []) add(item?.text, item?.confidence, item?.boundingBox);
  for (const item of Array.isArray(result?.otherDeclarations) ? result.otherDeclarations : []) add(typeof item === "string" ? item : item?.text, typeof item === "string" ? 0.55 : item?.confidence, null);
  for (const text of String(rawText || "").split(/\r?\n/)) add(text, 0.55, null);
  return lines;
}

function identityCandidateScore(line, allLines, excludeText = null) {
  const text = line.text;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (text.length < 3 || text.length > 60 || tokens.length > 6) return -1;
  if (PROMOTIONAL_TEXT.test(text) || IDENTITY_NOISE.test(text) || CLAIM_TEXT.test(text)) return -1;
  if (/^\+?\d[\d\s()\-]{7,}$/.test(text) || /^\d{6,15}$/.test(text)) return -1;
  if (excludeText && identityTokenSimilarity(text, excludeText) > 0.9) return -1;
  const normalized = text.toLowerCase();
  const repeats = allLines.reduce((count, candidate) => count + (candidate.text.toLowerCase() === normalized ? 1 : 0), 0);
  const nearRepeats = allLines.reduce((count, candidate) => count + (candidate.text.toLowerCase() !== normalized && identityTokenSimilarity(text, candidate.text) >= 0.82 ? 1 : 0), 0);
  const box = line.boundingBox;
  const area = box ? Math.max(0, Number(box.width) || 0) * Math.max(0, Number(box.height) || 0) : 0;
  const maxArea = Math.max(1, ...allLines.map((candidate) => candidate.boundingBox ? (Number(candidate.boundingBox.width) || 0) * (Number(candidate.boundingBox.height) || 0) : 0));
  const height = box ? Math.max(0, Number(box.height) || 0) : 0;
  const maxHeight = Math.max(1, ...allLines.map((candidate) => candidate.boundingBox ? Number(candidate.boundingBox.height) || 0 : 0));
  const prominence = area > 0 ? area / maxArea : height > 0 ? height / maxHeight : 0.35;
  let score = 0.28 + prominence * 0.42 + Math.max(0, Math.min(1, Number(line.confidence) || 0.55)) * 0.12;
  score += Math.min(0.3, repeats * 0.12 + nearRepeats * 0.06);
  if (text === text.toUpperCase()) score += 0.06;
  if (/^[A-Za-z][A-Za-z0-9&' .-]+$/.test(text)) score += 0.04;
  return score;
}

function chooseIdentity(lines, excludeText = null) {
  const scored = lines.map((line) => ({ line, score: identityCandidateScore(line, lines, excludeText) })).filter((item) => item.score >= 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const winner = scored[0];
  const cluster = scored.filter((item) => identityTokenSimilarity(item.line.text, winner.line.text) >= 0.82);
  const representative = cluster.sort((a, b) => {
    const exactA = lines.filter((line) => line.text.toLowerCase() === a.line.text.toLowerCase()).length;
    const exactB = lines.filter((line) => line.text.toLowerCase() === b.line.text.toLowerCase()).length;
    return (exactB * 1.2 + b.score) - (exactA * 1.2 + a.score);
  })[0] || winner;
  return { value: representative.line.text, confidence: Math.min(0.94, representative.score + 0.08), evidence: representative.line.text };
}

function sanitizeIdentityFields(result, rawText) {
  const next = { ...result };
  const lines = uniqueEvidenceLines(result, rawText);
  const currentBrand = String(next.brandName?.value || "").trim();
  const currentProduct = String(next.productName?.value || "").trim();
  const bestBrand = chooseIdentity(lines);
  const brandValue = currentBrand && !PROMOTIONAL_TEXT.test(currentBrand) && !IDENTITY_NOISE.test(currentBrand) && !CLAIM_TEXT.test(currentBrand)
    ? chooseIdentity(lines, currentProduct)?.value || currentBrand
    : bestBrand?.value || currentBrand;
  if (brandValue) {
    const brandEvidence = lines.find((line) => line.text.toLowerCase() === brandValue.toLowerCase()) || lines.find((line) => identityTokenSimilarity(line.text, brandValue) >= 0.82);
    next.brandName = {
      value: brandValue,
      raw: brandEvidence?.text || brandValue,
      confidence: Math.max(Number(next.brandName?.confidence || 0), Number(bestBrand?.confidence || 0.45)),
      evidence: brandEvidence?.text || brandValue,
      status: "found",
      source: "IDENTITY_CONSENSUS",
    };
  }
  const preferredProduct = chooseIdentity(lines, brandValue);
  if (preferredProduct) {
    const shouldReplace = !currentProduct || PROMOTIONAL_TEXT.test(currentProduct) || IDENTITY_NOISE.test(currentProduct) || CLAIM_TEXT.test(currentProduct) || identityTokenSimilarity(currentProduct, preferredProduct.value) < 0.65;
    if (shouldReplace) {
      next.productName = {
        value: preferredProduct.value,
        raw: preferredProduct.evidence,
        confidence: preferredProduct.confidence,
        evidence: preferredProduct.evidence,
        status: "found",
        source: "IDENTITY_CONSENSUS",
      };
    }
  }
  return next;
}

function isValidGtIn(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const check = Number(digits[digits.length - 1]);
  let sum = 0;
  let weight = 3;
  for (let index = digits.length - 2; index >= 0; index -= 1) {
    sum += Number(digits[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === check;
}

function repairBarcode(result, rawText) {
  const sources = [];
  const add = (text, context = "") => {
    const value = normalizeIdentityText(text);
    if (value) sources.push({ value, context: normalizeIdentityText(context) });
  };
  add(result?.barcode?.value, result?.barcode?.evidence);
  add(result?.barcode?.raw, result?.barcode?.evidence);
  for (const item of Array.isArray(result?.declarationEvidence) ? result.declarationEvidence : []) add(item?.text, item?.type || "");
  for (const item of Array.isArray(result?.otherDeclarations) ? result.otherDeclarations : []) add(typeof item === "string" ? item : item?.text, "");
  add(rawText);
  const candidates = [];
  for (const source of sources) {
    for (const match of source.value.match(/\d{8,18}/g) || []) {
      if (/\+?\d[\d\s()\-]{7,}$/.test(source.value) || /(?:phone|mobile|contact|toll\s*free|licen[cs]e|batch|consumer\s+care)/i.test(source.context) || /(?:phone|mobile|contact|toll\s*free|licen[cs]e|batch|consumer\s+care)/i.test(source.value)) continue;
      if (isValidGtIn(match)) candidates.push({ value: match, score: match.length === 13 ? 1 : 0.9 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  if (!winner) return result;
  return {
    ...result,
    barcode: {
      value: winner.value,
      raw: winner.value,
      confidence: Math.max(Number(result?.barcode?.confidence || 0), 0.9),
      evidence: `GTIN checksum-valid candidate: ${winner.value}`,
      status: "found",
      source: "GTIN_VALIDATION",
    },
  };
}

function detectInnerPackReference(rawText) {
  const text = normalizeIdentityText(rawText);
  if (!text || !INNER_PACK_REFERENCE.test(text)) return false;
  return true;
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
    const { paddle, semantic, heuristic, paddleMs, semanticMs, heuristicMs } = await analyzeWithPaddleAndGliner(images);
    const semanticSanitized = sanitizeSemanticResult(semantic);
    const identitySanitized = sanitizeIdentityFields(semanticSanitized, paddle.rawText);
    const codeSanitized = repairBarcode(identitySanitized, paddle.rawText);
    const innerPackReference = detectInnerPackReference(paddle.rawText);
    const merged = { ...codeSanitized };
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
    if (innerPackReference) {
      merged.innerPackReference = true;
      merged.warnings = Array.from(new Set([...(Array.isArray(merged.warnings) ? merged.warnings : []), "Package text refers to an individual/inner pack for additional batch, date, price, or related details."]));
      merged.semantic = { ...(merged.semantic || {}), innerPackReference: true };
    }
    const totalMs = Date.now() - startedAt;
    console.log(`[ocr:fast] images=${files.length} evidence=${paddle.evidence.length} upload=${uploadMs}ms paddle=${paddleMs}ms gliner+heuristic=${Math.max(semanticMs, heuristicMs)}ms total=${totalMs}ms`);
    const semanticWarning = merged?.warnings?.length ? merged.warnings : null;
    res.json({ result: merged, provider: merged?.semantic?.provider || "local-rules", model: merged?.semantic?.provider === "gliner2-local" ? "fastino/gliner2-base-v1" : "local rules", detectionProvider: "paddleocr", detectionProviders: ["paddleocr"], rawText: paddle.rawText, semantic: merged?.semantic || null, fallbackReason: semanticWarning?.[0] || null });
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
