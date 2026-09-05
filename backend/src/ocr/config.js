import os from "node:os";

export function getOcrConfig() {
  return {
    provider: "paddleocr",
    model: "PP-OCRv5",
    timeoutMs: Number.parseInt(process.env.OCR_TIMEOUT_MS || "30000", 10),
    geminiModel: process.env.GEMINI_SEMANTIC_MODEL || "gemini-2.5-flash-lite",
    confidenceThreshold: Number.parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD || "0.6"),
    maxImageSizeBytes: Number.parseInt(process.env.OCR_MAX_IMAGE_SIZE_BYTES || String(8 * 1024 * 1024), 10),
    maxImages: Number.parseInt(process.env.OCR_MAX_IMAGES_PER_REQUEST || "6", 10),
    tempDir: process.env.OCR_TEMP_DIR || os.tmpdir(),
  };
}
