import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scanPath = path.resolve(here, "../src/pages/ScanV2.jsx");
let source = await fs.readFile(scanPath, "utf8");

// Remove the browser-side OCR providers. The browser must make exactly one
// OCR request; the backend owns PaddleOCR + local semantic mapping.
source = source.replace(/\nconst PADDLE_OCR_URL =[^\n]*\n/, "\n");
source = source.replace(/\nconst MAX_PUTER_IMAGE_SIZE =[^\n]*\n/, "\n");
source = source.replace(/\nfunction normalizePuter\([\s\S]*?\nfunction readVisualInspection\(\)/, "\nfunction readVisualInspection()");

const runOcrBlock = `async function runOcr(files) {
  const fd = new FormData();
  files.forEach((file) => fd.append("images", file));
  const response = await apiFetch(\`${"${OCR_URL}"}/api/ocr/analyze\`, { method: "POST", body: fd });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.error || data.message || "Local OCR service unavailable.");
  if (!data.result) throw new Error("Local OCR returned no structured result.");
  return {
    result: data.result,
    provider: data.provider || "local",
    model: data.model || "local declaration mapper",
    semantic: data.semantic || data.result.semantic || null,
    detectionProvider: data.detectionProvider || "paddleocr",
    detectionProviders: data.detectionProviders || ["paddleocr"],
    fallbackReason: data.fallbackReason || null,
  };
}

export default function ScanV2()`;

// Replace everything from the first browser OCR provider through the component export.
source = source.replace(/\nasync function runGemini\([\s\S]*?\nexport default function ScanV2\(\)/, `\n${runOcrBlock}`);

source = source.replace(
  /setMessage\("Running PaddleOCR \+ Cloud Vision, with local declaration mapping and Gemini\/OpenAI fallback\.\.\."\);/,
  'setMessage("Running local PaddleOCR + GLiNER2 declaration mapping...");'
);

source = source.replace(
  /const semanticLabel = info\.semantic\?\.provider === "gemini"[\s\S]*?const providerMessage = `Hybrid analysis completed with \$\{semanticLabel\} \+ \$\{detectionLabel\}\. Running Rules Engine\.\.\.`;/,
  'const semanticLabel = info.semantic?.provider === "gliner2-local" ? "GLiNER2 local semantic mapper" : "Local declaration mapper";\n      const detectionLabel = info.detectionProviders?.length ? info.detectionProviders.join(" + ") : info.detectionProvider || "PaddleOCR";\n      const providerMessage = `${semanticLabel} + ${detectionLabel} completed. Running Rules Engine...`;'
);

// Remove legacy hybrid wording from visible copy if it survives elsewhere in the page.
source = source.replace(/detect printed text with PaddleOCR and Cloud Vision, map only relevant declarations with the hybrid semantic layer/, "detect printed text with local PaddleOCR and map relevant declarations with the local semantic layer");
source = source.replace(/Hybrid OCR and Rules Engine evaluation complete\./g, "Local OCR and Rules Engine evaluation complete.");

await fs.writeFile(scanPath, source, "utf8");
console.log("PARAKH frontend prepared for the local single-request OCR/GLiNER2 scan pipeline.");
