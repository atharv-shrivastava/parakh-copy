import fs from "node:fs/promises";

const OCR_ENGINE_URL = process.env.OCR_ENGINE_URL || "http://localhost:8081";

export async function runPaddleOCR(filePath) {
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([bytes]), filePath.split(/[\\/]/).pop());

  const response = await fetch(`${OCR_ENGINE_URL}/ocr`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OCR engine ${response.status}: ${detail}`);
  }

  return response.json();
}
