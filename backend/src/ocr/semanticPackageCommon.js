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

export function buildSemanticSchema(categoryOptions = []) {
  const fieldSchema = {
    type: "object",
    properties: {
      value: { type: "string", nullable: true },
      raw: { type: "string", nullable: true },
      evidence: { type: "string", nullable: true },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      status: { type: "string", enum: ["found", "absent", "unreadable", "ambiguous"] },
      imageIndex: { type: "integer", minimum: 0, nullable: true },
    },
    required: ["value", "raw", "evidence", "confidence", "status"],
  };

  return {
    type: "object",
    properties: {
      ...Object.fromEntries(FIELD_KEYS.map((key) => [key, fieldSchema])),
      suggestedCategory: {
        type: "object",
        properties: {
          categoryId: { type: "string", nullable: true },
          categoryName: { type: "string", nullable: true },
          categoryPath: { type: "string", nullable: true },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string", nullable: true },
        },
        required: ["categoryId", "categoryName", "categoryPath", "confidence", "reason"],
      },
    },
    required: [...FIELD_KEYS, "suggestedCategory"],
  };
}

export function buildSemanticPrompt({ detections = [], rawText = "", categoryOptions = [] } = {}) {
  const compactDetections = detections.slice(0, 350).map((item) => ({
    id: item.id,
    imageIndex: item.imageIndex,
    text: item.text,
    confidence: item.confidence,
  }));

  const categories = categoryOptions.slice(0, 500).map((item) => ({
    id: String(item.id),
    name: text(item.name),
    path: text(item.path),
  }));

  const outputKeys = [...FIELD_KEYS, "suggestedCategory"];
  return `You are PARAKH's package interpretation assistant. Your task is semantic reasoning over photographed packaged commodity images.

The supplied package image(s) are primary evidence. The supplied RapidOCR transcription is a supporting evidence layer. ALWAYS use BOTH the image(s) and the RapidOCR text together.

REASONING PROCESS:
1. Read the supplied RapidOCR detections and group related lines that likely belong to the same declaration.
2. Inspect the package image(s) to verify the OCR text, correct obvious OCR mistakes, and understand labels, headings, symbols, units and layout.
3. Determine what each value represents from semantic context. Do not require a declaration keyword to be immediately adjacent to the value.
4. Resolve packaging patterns such as a heading followed by a value, label/value pairs split across lines, repeated brand/product wording, and MRP markers such as 'READ MRP HERE'.
5. Cross-check values across all supplied images and prefer the clearest consistent evidence.
6. Return a field only when the image and/or OCR evidence supports it. Never invent missing values.

STRICT RULES:
- Images are authoritative for visible text and visual context.
- RapidOCR is supporting evidence, not a blind source of truth. If OCR contains a character error and the image clearly supports the correction, correct it.
- Never autocomplete a declaration from world knowledge or guess a value not supported by the supplied evidence.
- If a field is not visible or supported, status=absent and value=null.
- If the relevant text is visible but cannot be read reliably, status=unreadable and value=null.
- If two supported readings conflict, status=ambiguous and preserve the strongest evidence in raw/evidence.
- Preserve printed wording closely except for obvious OCR corrections supported by the image.
- Use semantic and visual/spatial context. A value may belong to a declaration even when the declaration label is above it, before it, on another line, separated by formatting, or represented by packaging shorthand.
- For MRP, quantity, dates, FSSAI, barcode and consumer-care details, prioritize exact visible characters plus contextual association.
- Distinguish MRP from sale price, discount price, offer price, unit price and other printed prices.
- Distinguish net quantity from serving size, pack count, dimensions and nutritional quantity.
- Distinguish manufacturing/packing/import dates from expiry/best-before dates.
- Distinguish manufacturer, packer, marketer and importer roles instead of collapsing them into one company.
- Product name and brand are separate fields. Do not assume the largest text is automatically the product name.
- Do not confuse generic descriptors such as Natural, Premium, Foods, Toothpaste, etc. with a brand unless packaging context clearly presents them as branding.
- Do not assess legal compliance. The deterministic rules engine does that.
- suggestedCategory MUST be selected only from the supplied final-category list. Never invent a categoryId.
- Choose the most specific category supported by the visible product identity. Lower confidence is preferable to an unsupported guess.

REQUIRED OUTPUT KEYS:
${JSON.stringify(outputKeys)}

Each field key above except suggestedCategory MUST be an object with exactly these conceptual properties:
{"value": string|null, "raw": string|null, "evidence": string|null, "confidence": number(0..1), "status": "found"|"absent"|"unreadable"|"ambiguous", "imageIndex": integer|null}

suggestedCategory MUST be an object with:
{"categoryId": string|null, "categoryName": string|null, "categoryPath": string|null, "confidence": number(0..1), "reason": string|null}

RAPIDOCR DETECTIONS:
${JSON.stringify(compactDetections)}

RAW RAPIDOCR TEXT:
${text(rawText)}

AVAILABLE FINAL CATEGORIES:
${JSON.stringify(categories)}

Return ONLY one valid JSON object with all required keys. No markdown. No commentary.`;
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
