import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const FIELD_KEYS = ["productName","brandName","manufacturer","manufacturerAddress","packer","packerAddress","importer","importerAddress","netQuantity","unit","mrp","currency","dateOfManufacture","dateOfPacking","bestBefore","expiryDate","batchNumber","consumerCarePhone","consumerCareEmail","countryOfOrigin","fssaiLicenseNumber","barcode"];

const FieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]), raw: z.union([z.string(), z.null()]), confidence: z.number().min(0).max(1), evidence: z.union([z.string(), z.null()]), status: z.enum(["found", "absent", "unreadable", "ambiguous"]), imageIndex: z.number().int().min(0).optional(),
}).nullable();

const ResultSchema = z.object({
  ...Object.fromEntries(FIELD_KEYS.map((key) => [key, FieldSchema])),
  otherDeclarations: z.array(z.string()).default([]),
  declarationEvidence: z.array(z.object({ imageIndex: z.number().int().min(0), type: z.string(), text: z.string(), confidence: z.number().min(0).max(1), boundingBox: z.any().nullable().default(null) })).default([]),
  rawText: z.string().default(""), warnings: z.array(z.string()).default([]), unreadableFields: z.array(z.string()).default([]), needsReview: z.boolean().default(false),
});

const descriptions = {
  productName: "product name as printed", brandName: "brand name", manufacturer: "manufacturer name", manufacturerAddress: "manufacturer printed address", packer: "separate packer name", packerAddress: "packer address", importer: "importer name", importerAddress: "importer address", netQuantity: "net quantity as a number", unit: "quantity unit", mrp: "maximum retail price as a number", currency: "MRP currency code", dateOfManufacture: "manufacturing date exactly as printed", dateOfPacking: "packing date exactly as printed", bestBefore: "best-before period or date", expiryDate: "expiry date", batchNumber: "batch or lot number", consumerCarePhone: "consumer care phone", consumerCareEmail: "consumer care email", countryOfOrigin: "country of origin", fssaiLicenseNumber: "FSSAI license number", barcode: "human-readable digits printed below a barcode; never decode the visual barcode symbol",
};

function normalize(result, threshold) {
  const next = { ...result };
  if (next.mrp?.status === "found" && typeof next.mrp.value === "string") {
    const match = next.mrp.value.trim().match(/^(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i);
    if (match) next.mrp = { ...next.mrp, value: Number(match[1].replace(/,/g, "")) };
  }
  if (next.netQuantity?.status === "found" && typeof next.netQuantity.value === "string") {
    const match = next.netQuantity.value.trim().match(/^([\d,]+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
    if (match) next.netQuantity = { ...next.netQuantity, value: Number(match[1].replace(/,/g, "")) };
  }

  const declarationEvidence = Array.isArray(next.declarationEvidence) ? [...next.declarationEvidence] : [];
  const existingKeys = new Set(declarationEvidence.map((item) => `${item.imageIndex}:${item.type}:${item.text}`));
  for (const key of FIELD_KEYS) {
    const field = next[key];
    if (!field || field.status !== "found") continue;
    const evidence = String(field.evidence ?? field.raw ?? field.value ?? "").trim();
    if (!evidence) continue;
    const imageIndex = Number.isInteger(field.imageIndex) ? field.imageIndex + 1 : 1;
    const typeMap = { productName: "PRODUCT_NAME", brandName: "BRAND", netQuantity: "NET_QUANTITY", unit: "NET_QUANTITY", mrp: "MRP", manufacturer: "MANUFACTURER", manufacturerAddress: "ADDRESS", packer: "PACKER", packerAddress: "ADDRESS", importer: "IMPORTER", importerAddress: "ADDRESS", countryOfOrigin: "COUNTRY_OF_ORIGIN", dateOfManufacture: "DATE_OF_MANUFACTURE", dateOfPacking: "DATE_OF_PACKING", bestBefore: "BEST_BEFORE", expiryDate: "EXPIRY_DATE", batchNumber: "BATCH_NUMBER", consumerCarePhone: "CONSUMER_CARE", consumerCareEmail: "CONSUMER_CARE", fssaiLicenseNumber: "FSSAI_LICENSE", barcode: "BARCODE", currency: "MRP" };
    const type = typeMap[key] || "OTHER_DECLARATION";
    const entryKey = `${imageIndex}:${type}:${evidence}`;
    if (!existingKeys.has(entryKey)) { declarationEvidence.push({ imageIndex, type, text: evidence, confidence: field.confidence, boundingBox: null }); existingKeys.add(entryKey); }
  }

  const unreadable = new Set(next.unreadableFields || []);
  let needsReview = false;
  for (const key of FIELD_KEYS) {
    const field = next[key];
    if (!field) continue;
    if (field.status === "unreadable" || field.status === "ambiguous") { unreadable.add(key); needsReview = true; }
    if (field.status === "found" && field.confidence < threshold) needsReview = true;
  }
  return { ...next, declarationEvidence, unreadableFields: [...unreadable], needsReview };
}

function buildPrompt() {
  return `You are PARAKH's strict package-information extraction engine. Read ONLY information visibly printed on the supplied product package images. Never guess, infer, complete, or invent values. If a field is not visible, mark absent. If present but illegible, mark unreadable. If conflicting or unclear, mark ambiguous. Preserve exact printed wording in raw and evidence. For every found field, set imageIndex to the zero-based index of the image where that evidence is visible. Keep evidence short and as close as possible to one printed line so it can be matched to OCR text detection. Normalize only value: MRP to a number and currency separately; net quantity to a number and unit separately. Barcode means only human-readable printed digits, never visual barcode decoding. Do not assess legal compliance. Return ONLY valid JSON with fields ${FIELD_KEYS.map((key) => `${key}: {value,raw,confidence,evidence,status,imageIndex}`).join(", ")}, declarationEvidence, otherDeclarations, rawText, warnings, unreadableFields and needsReview. declarationEvidence must list every visible declaration with imageIndex, declaration type, short exact printed text, confidence, and boundingBox:null. Image indexes inside declarationEvidence are one-based. Do not invent bounding boxes. Field meanings: ${Object.entries(descriptions).map(([key, value]) => `${key}=${value}`).join("; ")}.`;
}

function buildResponseSchema() {
  const field = { type: "object", properties: { value: { type: "string" }, raw: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 }, evidence: { type: "string" }, status: { type: "string", enum: ["found", "absent", "unreadable", "ambiguous"] }, imageIndex: { type: "integer", minimum: 0 } }, required: ["value", "raw", "confidence", "evidence", "status"] };
  const declarationEvidence = { type: "array", items: { type: "object", properties: { imageIndex: { type: "integer", minimum: 1 }, type: { type: "string" }, text: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 }, boundingBox: { type: "object", nullable: true } }, required: ["imageIndex", "type", "text", "confidence", "boundingBox"] } };
  return { type: "object", properties: { ...Object.fromEntries(FIELD_KEYS.map((key) => [key, field])), declarationEvidence, otherDeclarations: { type: "array", items: { type: "string" } }, rawText: { type: "string" }, warnings: { type: "array", items: { type: "string" } }, unreadableFields: { type: "array", items: { type: "string" } }, needsReview: { type: "boolean" } }, required: [...FIELD_KEYS, "declarationEvidence", "otherDeclarations", "rawText", "warnings", "unreadableFields", "needsReview"] };
}

export async function analyzePackage(images, config) {
  if (!config.apiKey) { const error = new Error("OCR is not configured. Add OCR_AI_API_KEY to the backend environment."); error.code = "OCR_NOT_CONFIGURED"; error.statusCode = 503; throw error; }
  if (config.provider !== "gemini") { const error = new Error(`Unsupported OCR provider: ${config.provider}. PARAKH currently uses Gemini.`); error.code = "OCR_PROVIDER_UNSUPPORTED"; error.statusCode = 500; throw error; }
  const ai = new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { timeout: config.timeoutMs } });
  const prompt = buildPrompt();
  try {
    const contents = [...images.map(({ base64, mediaType }) => ({ inlineData: { mimeType: mediaType, data: base64 } })), { text: prompt }];
    const response = await ai.models.generateContent({ model: config.model, contents, config: { systemInstruction: prompt, responseMimeType: "application/json", responseSchema: buildResponseSchema(), temperature: 0.1, maxOutputTokens: 4096, httpOptions: { timeout: config.timeoutMs } });
    const text = response.text;
    if (!text) { const error = new Error("Gemini returned no text response"); error.code = "OCR_EMPTY_RESPONSE"; error.statusCode = 502; throw error; }
    let parsed;
    try { parsed = JSON.parse(text); } catch { const error = new Error("Gemini returned malformed JSON"); error.code = "OCR_MALFORMED_RESPONSE"; error.statusCode = 502; throw error; }
    const validated = ResultSchema.safeParse(parsed);
    if (!validated.success) { const error = new Error(`OCR schema validation failed: ${validated.error.issues.map((issue) => issue.path.join(".")).join(", ")}`); error.code = "OCR_MALFORMED_RESPONSE"; error.statusCode = 502; throw error; }
    return normalize(validated.data, config.confidenceThreshold);
  } catch (error) {
    if (error.code?.startsWith("OCR_")) throw error;
    const wrapped = new Error(`Gemini OCR request failed: ${error.message}`); wrapped.code = "OCR_PROVIDER_ERROR"; wrapped.statusCode = 502; throw wrapped;
  }
}
