export const FIELD_KEYS = [
  "productName", "brandName", "manufacturer", "manufacturerAddress", "packer", "packerAddress",
  "marketer", "marketerAddress", "importer", "importerAddress", "netQuantity", "unit", "mrp",
  "currency", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "batchNumber",
  "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode",
];

export function confidence(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const FIELD_VALUE_SCHEMA = {
  type: "object",
  properties: {
    value: { type: "string", nullable: true },
    raw: { type: "string", nullable: true },
    evidence: { type: "string", nullable: true },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    status: { type: "string", enum: ["found", "absent", "unreadable", "ambiguous"] },
    imageIndex: { type: "integer", minimum: 0, nullable: true },
  },
  required: ["value", "confidence", "status"],
};

export function buildSemanticSchema(categoryOptions = []) {
  return {
    type: "object",
    properties: {
      ...Object.fromEntries(FIELD_KEYS.map((key) => [key, FIELD_VALUE_SCHEMA])),
      suggestedCategory: {
        type: "object",
        properties: {
          categoryId: { type: "string", nullable: true },
          categoryName: { type: "string", nullable: true },
          categoryPath: { type: "string", nullable: true },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string", nullable: true },
        },
        required: ["categoryId", "confidence"],
      },
    },
  };
}

export function buildSemanticPrompt({ detections = [], rawText = "", categoryOptions = [] } = {}) {
  const compactDetections = detections.slice(0, 220).map((item) => ({
    imageIndex: item.imageIndex,
    text: item.text,
    confidence: item.confidence,
  }));
  const categories = categoryOptions.slice(0, 300).map((item) => ({
    id: String(item.id),
    name: text(item.name),
    path: text(item.path),
  }));
  return `PARAKH semantic package mapper. Inspect the supplied package image(s) AND the RapidOCR text together.

Map only fields that are actually supported by the image/OCR. Use visual context and nearby headings, not just literal keyword matching. A value can belong to a label on another line or nearby, e.g. "READ MRP HERE" followed by a price. Correct obvious OCR mistakes only when the image supports the correction. Never invent or autocomplete values.

For each detected field return: value, confidence (0..1), status (found/absent/unreadable/ambiguous), and optionally raw, evidence, imageIndex. OMIT unsupported fields instead of returning long absent objects. Product name and brand are separate. Distinguish manufacturer/packer/marketer/importer. Distinguish net quantity from serving size. Distinguish MRP from sale/offer price. Do not assess legal compliance.

suggestedCategory must use only one supplied category id. Omit it when uncertain.

RapidOCR detections:
${JSON.stringify(compactDetections)}

Raw RapidOCR text:
${text(rawText)}

Final categories:
${JSON.stringify(categories)}

Return compact JSON only. No markdown, no commentary.`;
}

export function normalizeSemanticResult(parsed, categoryOptions = []) {
  const normalized = {};
  for (const key of FIELD_KEYS) {
    const value = parsed?.[key] || {};
    const statusRaw = String(value?.status || "").toLowerCase();
    const status = ["found", "absent", "unreadable", "ambiguous"].includes(statusRaw)
      ? statusRaw
      : value?.value != null && text(value.value) ? "found" : "absent";
    normalized[key] = {
      value: value?.value ?? null,
      raw: value?.raw ?? null,
      evidence: value?.evidence ?? value?.raw ?? value?.value ?? null,
      confidence: confidence(value?.confidence),
      status,
      ...(Number.isInteger(value?.imageIndex) ? { imageIndex: value.imageIndex } : {}),
    };
  }

  const suggestion = parsed?.suggestedCategory || {};
  const allowed = categoryOptions.find((item) => String(item.id) === String(suggestion.categoryId));
  const suggestedCategory = {
    categoryId: allowed ? String(allowed.id) : null,
    categoryName: allowed ? text(allowed.name) : text(suggestion.categoryName) || null,
    categoryPath: allowed ? text(allowed.path) : text(suggestion.categoryPath) || null,
    confidence: confidence(suggestion.confidence),
    reason: text(suggestion.reason) || null,
  };

  return { fields: normalized, suggestedCategory };
}

export function parseJsonContent(content) {
  if (typeof content === "object" && content) return content;
  const raw = text(content);
  if (!raw) throw new Error("Semantic model returned an empty response.");
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced ? fenced[1] : raw);
}
