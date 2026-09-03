import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../middleware/auth.js";
import { getOcrConfig } from "./config.js";
import { analyzePackage } from "./service.js";

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

router.post("/analyze", authenticate, upload.array("images", config.maxImages), async (req, res) => {
  const files = req.files || [];
  try {
    if (!files.length) return res.status(400).json({ error: { code: "OCR_NO_IMAGES", message: "Upload at least one package image." } });
    const images = [];
    for (const file of files) {
      const buffer = await fs.readFile(file.path);
      const mediaType = detectFormat(buffer);
      if (!mediaType) { const error = new Error(`Unsupported or invalid image: ${file.originalname}`); error.code = "OCR_UNSUPPORTED_FORMAT"; error.statusCode = 415; throw error; }
      images.push({ base64: buffer.toString("base64"), mediaType });
    }
    const result = await analyzePackage(images, config);
    res.json({ result, provider: "gemini", model: config.model });
  } catch (error) {
    console.error("[ocr]", error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: { code: error.code || "OCR_INTERNAL_ERROR", message: error.message || "OCR analysis failed." } });
  } finally {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
  }
});

export default router;
