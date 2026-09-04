import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scanPath = path.resolve(here, "../src/pages/ScanV2.jsx");
let source = await fs.readFile(scanPath, "utf8");

source = source
  .replace(/\nconst PADDLE_OCR_URL = .*?;\nconst MAX_IMAGES/, "\nconst MAX_IMAGES")
  .replace(/\nconst MAX_PUTER_IMAGE_SIZE = .*?;\n/, "\n")
  .replace(/\nfunction normalizePuter\(candidate, rawText\) \{[\s\S]*?\n\nfunction readVisualInspection\(\)/, "\nfunction readVisualInspection()")
  .replace(/\nasync function runGemini\(files\) \{[\s\S]*?\n\nexport default function ScanV2\(\)/, '\nasync function runOcr(files) {\n  const fd = new FormData();\n  files.forEach((file) => fd.append("images", file));\n  const response = await apiFetch(`${OCR_URL}/api/ocr/analyze`, { method: "POST", body: fd });\n  const data = await response.json().catch(() => ({}));\n  if (!response.ok) throw new Error(data.error?.message || data.error || data.message || "Local OCR service unavailable.");\n  if (!data.result) throw new Error("Local OCR returned no structured result.");\n  return {\n    result: data.result,\n    provider: data.provider || "local",\n    model: data.model || "local declaration mapper",\n    semantic: data.semantic || data.result.semantic || null,\n    detectionProvider: data.detectionProvider || "paddleocr",\n    detectionProviders: data.detectionProviders || ["paddleocr"],\n  };\n}\n\nexport default function ScanV2()')
  .replace(/setMessage\("Running PaddleOCR \+ Cloud Vision, with local declaration mapping and Gemini\/OpenAI fallback\.\.\."\);/, 'setMessage("Running local PaddleOCR + GLiNER2 declaration mapping...");')
  .replace(/const semanticLabel = info\.semantic\?\.provider === "gemini"[\s\S]*?const providerMessage = `Hybrid analysis completed with \$\{semanticLabel\} \+ \$\{detectionLabel\}\. Running Rules Engine\.\.\.`;/, 'const semanticLabel = info.semantic?.provider === "gliner2-local" ? "GLiNER2 local semantic mapper" : "Local declaration mapper";\n      const detectionLabel = info.detectionProviders?.length ? info.detectionProviders.join(" + ") : info.detectionProvider || "PaddleOCR";\n      const providerMessage = `${semanticLabel} + ${detectionLabel} completed. Running Rules Engine...`;');

await fs.writeFile(scanPath, source, "utf8");
console.log("PARAKH frontend prepared for the local OCR/GLiNER2 scan pipeline.");
