import fs from "node:fs/promises";
import FormData from "form-data";
import fetch from "node-fetch";

const OCR_ENGINE_URL = process.env.OCR_ENGINE_URL || "http://localhost:8081";

export async function runPaddleOCR(filePath) {
  const form = new FormData();
  form.append("file", await fs.readFile(filePath), { filename: filePath });

  const response = await fetch(`${OCR_ENGINE_URL}/ocr`, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OCR engine ${response.status}: ${detail}`);
  }

  return response.json();
}
