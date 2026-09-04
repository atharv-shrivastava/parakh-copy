import os from "node:os";

export function getOcrConfig() {
  return {
    provider: process.env.OCR_AI_PROVIDER || "gemini",
    model: process.env.OCR_AI_MODEL || "gemini-2.5-flash",
    apiKey: process.env.OCR_AI_API_KEY,
    geminiApiKey: process.env.OCR_AI_API_KEY || process.env.GEMINI_API_KEY,
    geminiModel: process.env.OCR_AI_MODEL || "gemini-2.5-flash",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiSemanticModel: process.env.OPENAI_SEMANTIC_MODEL || "gpt-5-mini",
    semanticProvider: process.env.OCR_SEMANTIC_PROVIDER || "gemini",
    cloudVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY,
    timeoutMs: Number.parseInt(process.env.OCR_TIMEOUT_MS || "30000", 10),
    semanticTimeoutMs: Number.parseInt(process.env.OCR_SEMANTIC_TIMEOUT_MS || "10000", 10),
    visionTimeoutMs: Number.parseInt(process.env.OCR_VISION_TIMEOUT_MS || "10000", 10),
    confidenceThreshold: Number.parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD || "0.6"),
    maxImageSizeBytes: Number.parseInt(process.env.OCR_MAX_IMAGE_SIZE_BYTES || String(8 * 1024 * 1024), 10),
    maxImages: Number.parseInt(process.env.OCR_MAX_IMAGES_PER_REQUEST || "6", 10),
    tempDir: process.env.OCR_TEMP_DIR || os.tmpdir(),
  };
}
