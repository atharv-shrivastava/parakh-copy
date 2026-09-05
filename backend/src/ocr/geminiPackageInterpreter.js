import { GoogleGenAI } from "@google/genai";

const FIELD_KEYS = [
  "productName", "brandName", "manufacturer", "manufacturerAddress", "packer", "packerAddress",
  "marketer", "marketerAddress", "importer", "importerAddress", "netQuantity", "unit", "mrp",
  "currency", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "batchNumber",
  "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode",
];

function confidence(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildSchema(categoryOptions) {
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

function buildPrompt({ detections = [], rawText = "", categoryOptions = [] }) {
  const compactDetections = detections.slice(0, 350).map((item) => ({
    id: item.id,
    imageIndex: item.imageIndex,
    text: item.text,
    confidence: item.confidence,
    boundingBox: item.boundingBox || null,
  }));

  const categories = categoryOptions.slice(0, 500).map((item) => ({
    id: String(item.id),
    name: text(item.name),
    path: text(item.path),
  }));

  return `You are PARAKH's package interpretation assistant. Use the supplied package images as the primary visual evidence and the PaddleOCR detections as optional supporting evidence. This request may run in parallel with OCR, so the OCR evidence can be empty. The images are authoritative for visible text and layout.\n\nSTRICT RULES:\n- Read only information visibly present on the package images or supported by supplied OCR detections.\n- Never invent, autocomplete, or infer a declaration that is not supported by visible evidence.\n- If a field is not visible, status=absent and value=null.\n- If visible but illegible, status=unreadable and value=null.\n- If conflicting evidence exists, status=ambiguous and preserve the best evidence in raw/evidence.\n- Preserve printed wording as closely as possible.\n- You may correct obvious OCR character errors only when the image itself clearly supports the correction.\n- For MRP, quantity, dates, FSSAI, barcode and contact details, prioritize exact visual text and nearby spatial context.\n- Product name and brand are independent fields. Use package layout, typography, surrounding descriptors and repeated evidence across images. Do not assume the largest text is always the product name.\n- Do not confuse manufacturer names with brands.\n- Do not confuse generic descriptors such as Natural, Premium, Foods, Toothpaste, etc. with a brand unless the package clearly presents them as branding.\n- Do not assess legal compliance.\n- suggestedCategory MUST be selected only from the supplied final-category list. Never invent a categoryId.\n- Choose the most specific category supported by visible product identity. If uncertain, use the closest available category with lower confidence.\n\nPADDLE OCR DETECTIONS (may be empty because OCR runs in parallel):\n${JSON.stringify(compactDetections)}\n\nRAW OCR TEXT (may be empty because OCR runs in parallel):\n${text(rawText)}\n\nAVAILABLE FINAL CATEGORIES:\n${JSON.stringify(categories)}\n\nReturn ONLY JSON matching the supplied schema.`;
}

export async function interpretPackageWithGemini({ images = [], detections = [], rawText = "", categoryOptions = [], signal } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OCR_AI_API_KEY || "";
  if (!apiKey) {
    return { enabled: false, reason: "GEMINI_API_KEY is not configured." };
  }

  const model = process.env.GEMINI_SEMANTIC_MODEL || "gemini-3.5-flash-lite";
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt({ detections, rawText, categoryOptions });

  const contents = [
    ...images.map(({ base64, mediaType }) => ({ inlineData: { mimeType: mediaType, data: base64 } })),
    { text: prompt },
  ];

  try {
    if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: buildSchema(categoryOptions),
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const normalized = {};
    for (const key of FIELD_KEYS) {
      const value = parsed?.[key];
      normalized[key] = {
        value: value?.value ?? null,
        raw: value?.raw ?? null,
        evidence: value?.evidence ?? null,
        confidence: confidence(value?.confidence),
        status: value?.status || (value?.value != null ? "found" : "absent"),
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

    return {
      enabled: true,
      provider: "gemini",
      model,
      fields: normalized,
      suggestedCategory,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    console.error("[ocr:gemini-semantic]", error);
    return {
      enabled: false,
      provider: "gemini",
      model,
      reason: error?.message || "Gemini semantic interpretation failed.",
    };
  }
}
