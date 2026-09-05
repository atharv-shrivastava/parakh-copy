export const FIELD_KEYS = [
  "productName", "brandName", "manufacturer", "manufacturerAddress", "packer", "packerAddress",
  "marketer", "marketerAddress", "importer", "importerAddress", "netQuantity", "unit", "mrp",
  "currency", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "batchNumber",
  "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode",
];

export function clampConfidence(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export function cleanText(value) {
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
    id: item?.id,
    imageIndex: item?.imageIndex,
    text: cleanText(item?.text),
    confidence: clampConfidence(item?.confidence),
  }));

  const categories = categoryOptions.slice(0, 500).map((item) => ({
    id: String(item?.id ?? ""),
    name: cleanText(item?.name),
    path: cleanText(item?.path),
  }));

  return `You are PARAKH's package interpretation assistant. Your task is semantic reasoning over photographs of a packaged commodity. The package images are the primary evidence. RapidOCR text is an important supporting transcription layer. Use BOTH together.

REASONING PROCESS:
1. Read the supplied RapidOCR detections and group related lines that likely belong to the same declaration.
2. Inspect the package images to verify the OCR text, correct obvious OCR mistakes, and understand nearby labels, headings, symbols, units and layout.
3. Determine what each value represents from its semantic context. Do not require the declaration keyword to be immediately adjacent to the value.
4. Resolve common packaging patterns such as a heading followed by a value, label/value pairs split across lines, repeated brand/product wording, and MRP markers such as 'READ MRP HERE'.
5. Cross-check values across all supplied images and prefer the clearest consistent evidence.
6. Return a field only when the image and/or OCR evidence supports it. Never invent missing values.

STRICT RULES:
- Images are authoritative for visible text and visual context.
- RapidOCR is supporting evidence, not a blind source of truth. If OCR contains a clear character error and the image supports the correction, correct it.
- Never autocomplete a declaration from world knowledge or guess a value that is not supported by the supplied evidence.
- If a field is not visible or supported, status=absent and value=null.
- If the relevant text is visible but cannot be read reliably, status=unreadable and value=null.
- If two supported readings conflict, status=ambiguous and preserve the strongest evidence in raw/evidence.
- Preserve printed wording closely except for obvious OCR corrections supported by the image.
- Use semantic and spatial context. A value can belong to a declaration even when the declaration label is on another line, above it, before it, or represented by packaging shorthand.
- For MRP, quantity, dates, FSSAI, barcode and consumer-care details, prioritize exact visible characters plus contextual association.
- Distinguish MRP from sale price, discount price, offer price, unit price and printed price.
- Distinguish net quantity from serving size, pack count, dimensions and nutritional quantity.
- Distinguish manufacturing/packing/import dates from expiry/best-before dates.
- Distinguish manufacturer, packer, marketer and importer roles instead of collapsing them into one company.
- Product name and brand are separate fields. Do not assume the largest text is automatically the product name.
- Do not confuse generic descriptors such as Natural, Premium, Foods, Toothpaste, etc. with a brand unless packaging context clearly presents them as branding.
- Do not assess legal compliance. The deterministic rules engine does that.
- suggestedCategory MUST be selected only from the supplied final-category list. Never invent a categoryId.
- Choose the most specific category supported by the visible product identity. Lower confidence is preferable to an unsupported guess.

RAPIDOCR DETECTIONS:
${JSON.stringify(compactDetections)}

RAW RAPIDOCR TEXT:
${cleanText(rawText)}

AVAILABLE FINAL CATEGORIES:
${JSON.stringify(categories)}

Return ONLY JSON matching the supplied schema.`;
}

export function normalizeSemanticResponse(parsed = {}, categoryOptions = []) {
  const normalized = {};
  for (const key of FIELD_KEYS) {
    const value = parsed?.[key];
    const status = ["found", "absent", "unreadable", "ambiguous"].includes(String(value?.status || "").toLowerCase())
      ? String(value.status).toLowerCase()
      : value?.value != null ? "found" : "absent";
    normalized[key] = {
      value: value?.value ?? null,
      raw: value?.raw ?? null,
      evidence: value?.evidence ?? null,
      confidence: clampConfidence(value?.confidence),
      status,
      ...(Number.isInteger(value?.imageIndex) ? { imageIndex: value.imageIndex } : {}),
    };
  }

  const suggestion = parsed?.suggestedCategory || {};
  const allowed = categoryOptions.find((item) => String(item?.id) === String(suggestion?.categoryId));
  return {
    fields: normalized,
    suggestedCategory: {
      categoryId: allowed ? String(allowed.id) : null,
      categoryName: allowed ? cleanText(allowed.name) : cleanText(suggestion.categoryName) || null,
      categoryPath: allowed ? cleanText(allowed.path) : cleanText(suggestion.categoryPath) || null,
      confidence: clampConfidence(suggestion.confidence),
      reason: cleanText(suggestion.reason) || null,
    },
  };
}
