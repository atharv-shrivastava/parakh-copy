import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const FIELD_KEYS = [
  "productName", "brandName", "manufacturer", "manufacturerAddress", "packer", "packerAddress",
  "importer", "importerAddress", "netQuantity", "unit", "mrp", "currency", "dateOfManufacture",
  "dateOfPacking", "bestBefore", "expiryDate", "batchNumber", "consumerCarePhone", "consumerCareEmail",
  "countryOfOrigin", "fssaiLicenseNumber", "barcode",
];

const FieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  raw: z.union([z.string(), z.null()]),
  confidence: z.number().min(0).max(1),
  evidence: z.union([z.string(), z.null()]),
  status: z.enum(["found", "absent", "unreadable", "ambiguous"]),
}).nullable();

const ResultSchema = z.object({
  ...Object.fromEntries(FIELD_KEYS.map((key) => [key, FieldSchema])),
  otherDeclarations: z.array(z.string()).default([]),
  rawText: z.string().default(""),
  warnings: z.array(z.string()).default([]),
  unreadableFields: z.array(z.string()).default([]),
  needsReview: z.boolean().default(false),
});

const descriptions = {
  productName: "product name as printed", brandName: "brand name", manufacturer: "manufacturer name",
  manufacturerAddress: "manufacturer printed address", packer: "separate packer name", packerAddress: "packer address",
  importer: "importer name", importerAddress: "importer address", netQuantity: "net quantity as a number",
  unit: "quantity unit", mrp: "maximum retail price as a number", currency: "MRP currency code",
  dateOfManufacture: "manufacturing date exactly as printed", dateOfPacking: "packing date exactly as printed",
  bestBefore: "best-before period or date", expiryDate: "expiry date", batchNumber: "batch or lot number",
  consumerCarePhone: "consumer care phone", consumerCareEmail: "consumer care email",
  countryOfOrigin: "country of origin", fssaiLicenseNumber: "FSSAI license number", barcode: "human-readable digits printed below a barcode, never decoded from the symbol",
};

function emptyField() {
  return { value: null, raw: null, confidence: 0, evidence: null, status: "absent" };
}

function normalize(result) {
  const next = { ...result };
  if (next.mrp?.status === "found" && typeof next.mrp.value === "string") {
    const match = next.mrp.value.trim().match(/^(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i);
    if (match) next.mrp = { ...next.mrp, value: Number(match[1].replace(/,/g, "")) };
  }
  if (next.netQuantity?.status === "found" && typeof next.netQuantity.value === "string") {
    const match = next.netQuantity.value.trim().match(/^([\d,]+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
    if (match) next.netQuantity = { ...next.netQuantity, value: Number(match[1].replace(/,/g, "")) };
  }
  const unreadable = new Set(next.unreadableFields || []);
  let needsReview = false;
  for (const key of FIELD_KEYS) {
    const field = next[key];
    if (!field) continue;
    if (field.status === "unreadable" || field.status === "ambiguous") { unreadable.add(key); needsReview = true; }
    if (field.status === "found" && field.confidence < 0.6) needsReview = true;
  }
  return { ...next, unreadableFields: [...unreadable], needsReview };
}

function buildPrompt() {
  return `You are PARAKH's strict package-information extraction engine. Read only information visibly printed on the supplied product package images. Never guess, infer, complete, or invent values. If a field is not visible, mark it absent. If present but illegible, mark it unreadable. If conflicting or unclear, mark it ambiguous. Preserve exact printed wording in raw and evidence. Normalize only value: MRP to a number and currency separately; net quantity to a number and unit separately. Barcode means only human-readable printed digits, not visual barcode decoding. Do not assess legal compliance. Return ONLY valid JSON with these fields: ${FIELD_KEYS.map((k) => `${k}: {value,raw,confidence,evidence,status}`).join(", ")}, plus otherDeclarations (array), rawText (string), warnings (array), unreadableFields (array), needsReview (boolean). Field meanings: ${Object.entries(descriptions).map(([k,v]) => `${k}=${v}`).join("; ")}.`;
}

export async function analyzePackage(images, config) {
  if (!config.apiKey) {
    const error = new Error("OCR is not configured. Add OCR_AI_API_KEY to the backend environment.");
    error.code = "OCR_NOT_CONFIGURED"; error.statusCode = 503; throw error;
  }
  if (config.provider !== "anthropic") {
    const error = new Error(`Unsupported OCR provider: ${config.provider}`);
    error.code = "OCR_PROVIDER_UNSUPPORTED"; error.statusCode = 500; throw error;
  }

  const client = new Anthropic({ apiKey: config.apiKey });
  const content = [
    ...images.map(({ base64, mediaType }) => ({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } })),
    { type: "text", text: buildPrompt() },
  ];

  let response;
  try {
    response = await client.messages.create({ model: config.model, max_tokens: 4096, system: buildPrompt(), messages: [{ role: "user", content }] }, { timeout: config.timeoutMs });
  } catch (error) {
    const wrapped = new Error(`OCR provider request failed: ${error.message}`);
    wrapped.code = "OCR_PROVIDER_ERROR"; wrapped.statusCode = 502; throw wrapped;
  }

  const text = response.content?.find((block) => block.type === "text")?.text;
  if (!text) {
    const error = new Error("OCR provider returned no text response");
    error.code = "OCR_EMPTY_RESPONSE"; error.statusCode = 502; throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
  } catch {
    const error = new Error("OCR provider returned malformed JSON");
    error.code = "OCR_MALFORMED_RESPONSE"; error.statusCode = 502; throw error;
  }

  const validated = ResultSchema.safeParse(parsed);
  if (!validated.success) {
    const error = new Error(`OCR schema validation failed: ${validated.error.issues.map((i) => i.path.join(".")).join(", ")}`);
    error.code = "OCR_MALFORMED_RESPONSE"; error.statusCode = 502; throw error;
  }
  return normalize(validated.data);
}

export { FIELD_KEYS, emptyField };
