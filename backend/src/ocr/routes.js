import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../middleware/auth.js";
import { getOcrConfig } from "./config.js";
import { analyzeWithCloudVision } from "./cloudVision.js";
import { runSemanticMapper } from "./semanticMapper.js";

const router = express.Router();
const config = getOcrConfig();
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const storage = multer.diskStorage({ destination: (_req, _file, cb) => cb(null, config.tempDir), filename: (_req, file, cb) => cb(null, `parakh-ocr-${crypto.randomUUID()}${path.extname(file.originalname)}`) });
const upload = multer({ storage, fileFilter: (_req, file, cb) => allowedTypes.has(file.mimetype) ? cb(null, true) : cb(Object.assign(new Error("Only JPEG, PNG and WebP images are supported."), { code: "OCR_UNSUPPORTED_FORMAT", statusCode: 415 })), limits: { files: config.maxImages, fileSize: config.maxImageSizeBytes } });

function detectFormat(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && segmentLength >= 7) return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    offset += segmentLength;
  }
  return null;
}

function imageDimensions(buffer, mediaType) {
  if (mediaType === "image/png" && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mediaType === "image/jpeg") return jpegDimensions(buffer);
  if (mediaType === "image/webp" && buffer.length >= 30) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (chunk === "VP8L" && buffer[21] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

function safeDimensions(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({ width: Number(item?.width) || 0, height: Number(item?.height) || 0 }));
  } catch {
    return [];
  }
}

async function readUploadedImages(files, providedDimensions = []) {
  const images = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const buffer = await fs.readFile(file.path);
    const mediaType = detectFormat(buffer);
    if (!mediaType) {
      const error = new Error(`Unsupported or invalid image: ${file.originalname}`);
      error.code = "OCR_UNSUPPORTED_FORMAT";
      error.statusCode = 415;
      throw error;
    }
    const parsedDimensions = imageDimensions(buffer, mediaType) || providedDimensions[index] || null;
    images.push({
      base64: buffer.toString("base64"),
      mediaType,
      imageWidth: Number(parsedDimensions?.width) || 0,
      imageHeight: Number(parsedDimensions?.height) || 0,
    });
  }
  return images;
}

async function runHybrid(images) {
  const vision = await analyzeWithCloudVision(images, config);
  const semantic = await runSemanticMapper(vision.evidence, config);
  return { vision, semantic };
}

async function handleAnalyze(req, res, files, routeName) {
  try {
    if (!files.length) return res.status(400).json({ error: { code: "OCR_NO_IMAGES", message: "Upload at least one package image." } });
    const images = await readUploadedImages(files, safeDimensions(req.body?.dimensions));
    const { vision, semantic } = await runHybrid(images);
    res.json({
      result: semantic,
      provider: semantic.semantic?.provider || "local",
      model: semantic.semantic?.provider === "openai" ? config.openaiSemanticModel : semantic.semantic?.provider === "gemini" ? config.geminiModel : "local declaration mapper",
      detectionProvider: vision.provider,
      detectionProviders: [vision.provider],
      rawText: vision.rawText,
      semantic: semantic.semantic,
    });
  } catch (error) {
    console.error(`[${routeName}]`, error);
    const status = error.statusCode || 502;
    res.status(status).json({ error: { code: error.code || "OCR_HYBRID_ERROR", message: error.message || "OCR analysis failed." } });
  } finally {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
  }
}

router.post("/analyze", authenticate, upload.array("images", config.maxImages), (req, res) => handleAnalyze(req, res, req.files || [], "ocr"));
router.post("/hybrid", authenticate, upload.array("images", config.maxImages), (req, res) => handleAnalyze(req, res, req.files || [], "ocr:hybrid"));

export default router;
