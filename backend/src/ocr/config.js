import os from "node:os";

export function getOcrConfig() {
  return {
    provider: process.env.OCR_AI_PROVIDER || "anthropic",
    model: process.env.OCR_AI_MODEL || "claude-sonnet-4-6",
    apiKey: process.env.OCR_AI_API_KEY,
    timeoutMs: Number.parseInt(process.env.OCR_TIMEOUT_MS || "30000", 10),
    confidenceThreshold: Number.parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD || "0.6"),
    maxImageSizeBytes: Number.parseInt(process.env.OCR_MAX_IMAGE_SIZE_BYTES || String(8 * 1024 * 1024), 10),
    maxImages: Number.parseInt(process.env.OCR_MAX_IMAGES_PER_REQUEST || "6", 10),
    tempDir: process.env.OCR_TEMP_DIR || os.tmpdir(),
  };
}

export function assertOcrConfig(config) {
  if (config.provider === "anthropic" && !config.apiKey) {
    throw new Error("OCR_AI_API_KEY is required when OCR_AI_PROVIDER=anthropic");
  }
}
