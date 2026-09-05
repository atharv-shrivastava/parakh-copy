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
import { interpretPackageWithCloudflare } from "./cloudflarePackageInterpreter.js";
import { reconcileSemanticResults } from "./semanticConsensus.js";

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

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function analyzeWithRapid(images) {
  const formData = new FormData();
  const ocrUrl = process.env.RAPID_OCR_URL || process.env.PADDLE_OCR_URL || "http://localhost:8081";

  images.forEach((image, imageIndex) => {
    const bytes = Buffer.from(image.base64, "base64");
    formData.append(
      "images",
      new Blob([bytes], { type: image.mediaType }),
      `parakh-${imageIndex + 1}.${extension(image.mediaType)}`,
    );
  });

  const response = await fetch(`${ocrUrl}/api/ocr/analyze`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(
      new Error(data?.error || data?.message || data?.detail || `RapidOCR failed (${response.status}).`),
      { code: "OCR_RAPID_ERROR", statusCode: 502 },
    );
  }

  const evidence = Array.isArray(data?.result?.declarationEvidence)
    ? data.result.declarationEvidence
      .map((item, index) => {
        const serviceImageIndex = Number(item?.imageIndex);
        return {
          id: String(item?.id ?? `rapid-evidence-${index}`),
          imageIndex: Number.isFinite(serviceImageIndex) && serviceImageIndex >= 1
            ? serviceImageIndex - 1
            : 0,
          text: normalizeText(item?.text),
          confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
        };
      })
      .filter((item) => item.text)
    : [];

  const rawText = normalizeText(data?.result?.rawText) || evidence.map((item) => item.text).join("\n");
  return {
    provider: "rapidocr",
    model: "RapidOCR",
    rawText,
    evidence,
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
    ...(field.source ? { source: field.source } : {}),
    ...(field.verification ? { verification: field.verification } : {}),
    ...(field.votes ? { votes: field.votes } : {}),
  };
}

function mergeSemanticFields(deterministicFields, aiFields, aiEnabled) {
  if (aiEnabled) {
    return Object.fromEntries(Object.keys(aiFields || {}).map((key) => [key, normalizeField(aiFields[key])]));
  }

  const merged = {};
  const keys = new Set([...Object.keys(deterministicFields || {}), ...Object.keys(aiFields || {})]);
  for (const key of keys) {
    const local = normalizeField(deterministicFields?.[key]);
    const ai = aiFields?.[key];
    if (ai && ai.status === "found" && ai.value != null) {
      const aiConfidence = Number(ai.confidence || 0);
      const localConfidence = Number(local.confidence || 0);
      if (local.status === "absent" || local.status === "unreadable" || local.status === "ambiguous" || (localConfidence < 0.65 && aiConfidence >= localConfidence + 0.12)) {
        merged[key] = {
          value: ai.value,
          raw: ai.raw || ai.value,
          confidence: aiConfidence,
          evidence: ai.evidence || ai.raw || ai.value,
          status: ai.status,
          ...(Number.isInteger(ai.imageIndex) ? { imageIndex: ai.imageIndex } : {}),
          source: "SEMANTIC_FIELD_MAPPING",
          deterministicFallback: local.value ?? null,
        };
        continue;
      }
    }
    merged[key] = local;
  }
  return merged;
}

function buildSemanticDeclarationEvidence(fields) {
  return Object.entries(fields || {})
    .map(([key, field], index) => {
      const normalized = normalizeField(field);
      const value = normalized.value == null ? "" : normalizeText(normalized.value);
      if (!value) return null;
      return {
        id: `semantic-${key}-${index}`,
        imageIndex: Number.isInteger(normalized.imageIndex) ? normalized.imageIndex : 0,
        type: key.toUpperCase(),
        label: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
        text: value,
        value,
        confidence: normalized.confidence,
        status: normalized.status,
        source: field?.source || "SEMANTIC_CONSENSUS",
        ...(field?.verification ? { verification: field.verification } : {}),
      };
    })
    .filter(Boolean);
}

function buildStructuredResult(rapid, aiSemantic = null) {
  const reconciliation = interpretOcrFields({
    detections: rapid.evidence,
    rawText: rapid.rawText,
  });

  const fields = mergeSemanticFields(
    reconciliation?.fields || {},
    aiSemantic?.fields || {},
    Boolean(aiSemantic?.enabled),
  );
  const result = {};
  for (const key of [
    "productName", "brandName", "manufacturer", "manufacturerAddress", "packer", "packerAddress",
    "marketer", "marketerAddress", "importer", "importerAddress", "netQuantity", "unit", "mrp",
    "currency", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "batchNumber",
    "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode",
  ]) {
    result[key] = normalizeField(fields[key]);
  }

  const rawDeclarationEvidence = rapid.evidence
    .filter((item) => item.text)
    .map((item, index) => ({
      id: String(item.id || `ocr-evidence-${index}`),
      imageIndex: Number(item.imageIndex || 0),
      type: "OCR_TEXT",
      text: item.text,
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.55)),
      source: "rapidocr",
    }));
  const declarationEvidence = buildSemanticDeclarationEvidence(fields);

  const warnings = [];
  if (reconciliation?.metadata?.innerPackReference) {
    warnings.push("Package text refers to an individual/inner pack for additional batch, date, price, or related details.");
  }
  if (!aiSemantic?.enabled) {
    warnings.push("All remote AI semantic providers unavailable; using local deterministic field mapping only.");
  }
  if (aiSemantic?.enabled && aiSemantic.providerCount < 3) {
    warnings.push(`Semantic verification used ${aiSemantic.providerCount} available AI provider(s); unavailable providers did not block the scan.`);
  }

  const needsReview = Object.values(result).some((field) =>
    field?.status === "unreadable" || field?.status === "ambiguous" ||
    (field?.status === "found" && Number(field.confidence || 0) < 0.6),
  );

  return {
    ...result,
    otherDeclarations: rawDeclarationEvidence.map((item) => item.text),
    declarationEvidence,
    rawOcrEvidence: rawDeclarationEvidence,
    rawText: rapid.rawText,
    warnings,
    unreadableFields: Object.entries(result).filter(([, field]) => field?.status === "unreadable").map(([key]) => key),
    needsReview,
    semanticReconciliation: aiSemantic?.enabled ? {
      providerCount: aiSemantic.providerCount,
      providers: aiSemantic.providers,
    } : reconciliation?.metadata || null,
    candidateEvidence: reconciliation?.candidateEvidence || {},
    aiSemantic: aiSemantic?.enabled ? {
      providerCount: aiSemantic.providerCount,
      providers: aiSemantic.providers,
      suggestedCategory: aiSemantic.suggestedCategory,
    } : null,
  };
}

async function readImages(files) {
  return Promise.all(files.map(async (file) => ({
    base64: (await fs.readFile(file.path)).toString("base64"),
    mediaType: file.mimetype,
  })));
}

async function runSemanticProviders({ images, rapid, categoryOptions }) {
  const cloudflareGemma = "@cf/google/gemma-4-26b-a4b-it";
  const cloudflareLlama = "@cf/meta/llama-4-scout-17b-16e-instruct";
  const providers = [
    { name: "gemini", fn: interpretPackageWithGemini, args: {} },
    { name: "cloudflare-gemma", fn: interpretPackageWithCloudflare, args: { modelOverride: cloudflareGemma, providerName: "cloudflare-gemma" } },
    { name: "cloudflare-llama", fn: interpretPackageWithCloudflare, args: { modelOverride: cloudflareLlama, providerName: "cloudflare-llama" } },
  ];

  const settled = await Promise.all(providers.map(async ({ name, fn, args }) => {
    const started = Date.now();
    try {
      const providerResult = await fn({
        images,
        detections: rapid.evidence,
        rawText: rapid.rawText,
        categoryOptions,
        ...args,
      });
      return {
        ...providerResult,
        provider: providerResult?.provider || name,
        timingMs: Date.now() - started,
      };
    } catch (error) {
      return {
        enabled: false,
        provider: name,
        model: args.modelOverride || null,
        reason: error?.message || `${name} semantic provider failed.`,
        timingMs: Date.now() - started,
      };
    }
  }));

  const consensus = reconcileSemanticResults(settled, categoryOptions);
  return {
    ...consensus,
    timing: Object.fromEntries(settled.map((provider) => [provider.provider, provider.timingMs])),
  };
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

    const rapidStart = Date.now();
    const rapid = await analyzeWithRapid(images);
    const rapidMs = Date.now() - rapidStart;

    const semanticStart = Date.now();
    const aiSemantic = await runSemanticProviders({ images, rapid, categoryOptions });
    const semanticMs = Date.now() - semanticStart;

    const result = buildStructuredResult(rapid, aiSemantic);
    const totalMs = Date.now() - startedAt;
    const parallelMs = totalMs - uploadMs;

    console.log(
      `[ocr:fast] images=${files.length} evidence=${rapid.evidence.length} rapid=${rapidMs}ms `
      + `semantic=${semanticMs}ms gemini=${aiSemantic.timing?.gemini ?? 0}ms `
      + `cloudflare-gemma=${aiSemantic.timing?.["cloudflare-gemma"] ?? 0}ms `
      + `cloudflare-llama=${aiSemantic.timing?.["cloudflare-llama"] ?? 0}ms `
      + `providers=${aiSemantic.providerCount} total=${totalMs}ms`,
    );

    res.json({
      result,
      provider: "rapidocr",
      model: "RapidOCR",
      detectionProvider: "rapidocr",
      detectionProviders: ["rapidocr"],
      rawText: rapid.rawText,
      semantic: aiSemantic.enabled ? {
        provider: "consensus",
        providers: aiSemantic.providers,
        providerCount: aiSemantic.providerCount,
        enabled: true,
      } : null,
      aiSuggestedCategory: aiSemantic.suggestedCategory || null,
      aiSemanticEnabled: Boolean(aiSemantic.enabled),
      aiSemanticError: aiSemantic.enabled ? null : "No semantic AI provider was available.",
      timing: {
        uploadMs,
        rapidMs,
        semanticMs,
        geminiMs: aiSemantic.timing?.gemini ?? 0,
        cloudflareGemmaMs: aiSemantic.timing?.["cloudflare-gemma"] ?? 0,
        cloudflareLlamaMs: aiSemantic.timing?.["cloudflare-llama"] ?? 0,
        totalMs,
        parallelMs,
      },
      fallbackReason: result.warnings?.find((item) => item.includes("remote AI semantic providers unavailable")) || null,
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
