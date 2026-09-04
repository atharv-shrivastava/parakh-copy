import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scanPath = path.resolve(here, "../src/pages/ScanV2.jsx");
const source = await fs.readFile(scanPath, "utf8");

const forbidden = [
  "runGemini(",
  "runPuter(",
  "runPaddle(",
  "PADDLE_OCR_URL",
  "window.puter",
  "Cloud Vision",
  "Gemini/OpenAI fallback",
  "Puter.js",
];

const stale = forbidden.filter((token) => source.includes(token));
if (stale.length) {
  throw new Error(`ScanV2.jsx still contains legacy browser OCR tokens: ${stale.join(", ")}`);
}

if (!source.includes("/api/ocr/analyze")) {
  throw new Error("ScanV2.jsx is missing the local backend OCR request.");
}

console.log("PARAKH frontend scan pipeline verified: single local backend OCR request.");
