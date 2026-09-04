import { z } from "zod";

export const DECLARATION_TYPES = [
  "PRODUCT_NAME",
  "BRAND",
  "MRP",
  "NET_QUANTITY",
  "MANUFACTURER",
  "PACKER",
  "MARKETER",
  "IMPORTER",
  "ADDRESS",
  "BATCH_NUMBER",
  "DATE_OF_MANUFACTURE",
  "DATE_OF_PACKING",
  "BEST_BEFORE",
  "EXPIRY_DATE",
  "CONSUMER_CARE",
  "COUNTRY_OF_ORIGIN",
  "FSSAI_LICENSE",
  "BARCODE",
];

const CandidateSchema = z.object({
  id: z.string(),
  imageIndex: z.number().int().min(0),
  text: z.string().min(1),
  confidence: z.number().min(0).max(1).optional().default(0),
  boundingBox: z.object({ left: z.number(), top: z.number(), width: z.number(), height: z.number() }).nullable().default(null),
});

const LlmResultSchema = z.object({
  mappings: z.array(z.object({
    id: z.string(),
    type: z.enum(DECLARATION_TYPES),
    value: z.string().nullable().default(null),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  })).default([]),
});

const LOCAL_RULES = [
  { type: "MRP", priority: 100, patterns: [/\bm\.?r\.?p\.?\b/i, /maximum\s+retail\s+price/i, /₹\s*[0-9oOlI]{1,6}(?:[.,][0-9]{1,2})?/i, /(?:rs\.?|inr)\s*[0-9oOlI]{1,6}(?:[.,][0-9]{1,2})?/i] },
  { type: "NET_QUANTITY", priority: 95, patterns: [/\bnet\s*(?:qty|quantity|weight|volume)\b/i, /\b(?:[0-9oOlI]{1,6}(?:[.,][0-9]{1,3})?)\s*(?:g|kg|mg|ml|l|cl|oz|lb)\b/i] },
  { type: "BATCH_NUMBER", priority: 90, patterns: [/\b(?:batch|lot)\s*(?:no|number|#)?\b/i, /\bb\.?\s*no\.?\b/i] },
  { type: "DATE_OF_MANUFACTURE", priority: 88, patterns: [/\b(?:mfd|mfg|manufactured)\b/i, /\bmanufactur(?:ed|e|ing)\s*(?:on|date)?\b/i] },
  { type: "DATE_OF_PACKING", priority: 86, patterns: [/\b(?:packed|packing|pkd)\s*(?:on|date)?\b/i] },
  { type: "BEST_BEFORE", priority: 100, patterns: [/\bbest\s*before\b/i, /\buse\s*within\b/i, /\bshelf\s*life\b/i] },
  { type: "EXPIRY_DATE", priority: 99, patterns: [/\b(?:expiry|expires|exp\.?)\b/i, /\buse\s*by\b/i] },
  { type: "MANUFACTURER", priority: 92, patterns: [/\bmanufactured\s+by\b/i, /\bmanufactured\s+(?:for|at)\b/i] },
  { type: "PACKER", priority: 92, patterns: [/\bpacked\s+by\b/i, /\bpacker\b/i] },
  { type: "MARKETER", priority: 92, patterns: [/\bmarketed\s+by\b/i, /\bmarketed\b/i] },
  { type: "IMPORTER", priority: 92, patterns: [/\bimported\s+by\b/i, /\bimporter\b/i] },
  { type: "CONSUMER_CARE", priority: 82, patterns: [/\bcustomer\s*care\b/i, /\bconsumer\s*care\b/i, /\bhelpline\b/i, /\b(?:toll\s*free|phone|contact)\b/i] },
  { type: "COUNTRY_OF_ORIGIN", priority: 82, patterns: [/\bcountry\s+of\s+origin\b/i, /\bmade\s+in\b/i, /\bproduct\s+of\b/i] },
  { type: "FSSAI_LICENSE", priority: 84, patterns: [/\bfssai\b/i, /\blic(?:ense|ence)\s*(?:no|number)?\b/i] },
  { type: "BARCODE", priority: 78, patterns: [/\b(?:barcode|bar\s*code)\b/i, /\b[0-9]{8,14}\b/] },
  { type: "ADDRESS", priority: 50, patterns: [/\b(?:address|road|rd\.?|street|st\.?|nagar|district|dist\.?|pin\s*code)\b/i] },
];

const STOPWORDS = new Set(["and", "or", "the", "with", "for", "from", "this", "that", "pack", "product", "quality", "premium", "since", "www", "com"]);

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u00a0\t]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalForMatch(value) {
  return normalizeText(value)
    .replace(/[₹]/g, " rs ")
    .replace(/[|]/g, "I")
    .replace(/\bM\s*R\s*P\b/gi, "MRP")
    .toLowerCase();
}

function scoreRule(text, rule) {
  const source = canonicalForMatch(text);
  const hits = rule.patterns.filter((pattern) => pattern.test(source));
  if (!hits.length) return 0;
  return rule.priority + Math.min(12, Math.max(...hits.map((pattern) => String(pattern).length / 8)));
}

function valueLooksValid(type, text) {
  const source = normalizeText(text);
  if (type === "MRP") return /(?:₹|rs\.?|inr)\s*[0-9][0-9,]*(?:[.,][0-9]{1,2})?/i.test(source) || /\bm\.?r\.?p\.?\b.*[0-9]/i.test(source);
  if (type === "NET_QUANTITY") return /[0-9][0-9,.]*\s*(?:mg|g|kg|ml|l|cl|oz|lb)\b/i.test(source);
  if (["DATE_OF_MANUFACTURE", "DATE_OF_PACKING", "BEST_BEFORE", "EXPIRY_DATE"].includes(type)) return /(?:\d{1,4}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}\s*(?:months?|years?|days?))/i.test(source);
  if (type === "BARCODE") return /\b\d{8,14}\b/.test(source);
  return true;
}

function extractValue(type, text) {
  const source = normalizeText(text);
  if (type === "MRP") {
    const match = source.match(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)/i);
    return match?.[1]?.replace(/,/g, "") || null;
  }
  if (type === "NET_QUANTITY") {
    const match = source.match(/([0-9][0-9,.]*)\s*(mg|g|kg|ml|l|cl|oz|lb)\b/i);
    return match ? `${match[1].replace(/,/g, "")} ${match[2]}` : null;
  }
  return source;
}

function classifyLocal(candidate) {
  const text = normalizeText(candidate.text);
  const scored = LOCAL_RULES
    .map((rule) => ({ rule, score: scoreRule(text, rule) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return { state: "UNMATCHED", candidate };

  const best = scored[0];
  const second = scored[1];
  if (second && best.score - second.score < 7) return { state: "AMBIGUOUS", candidates: scored.slice(0, 3), candidate };

  const valid = valueLooksValid(best.rule.type, text);
  if (!valid) return { state: "INVALID_VALUE", candidates: [best], candidate };

  const confidence = best.score >= 95 ? "HIGH" : best.score >= 84 ? "MEDIUM" : "LOW";
  return {
    state: confidence === "HIGH" ? "LOCAL_CONFIDENT" : "LOCAL_PLAUSIBLE",
    type: best.rule.type,
    confidence,
    value: extractValue(best.rule.type, text),
    candidate,
  };
}

export function selectCandidates(evidence) {
  return evidence
    .map((item, index) => ({
      id: String(item.id ?? `${Number(item.imageIndex) || 0}:${index}`),
      imageIndex: Math.max(0, Number(item.imageIndex) || 0),
      text: normalizeText(item.text),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      boundingBox: item.boundingBox || null,
    }))
    .filter((item) => {
      if (!item.text) return false;
      const words = item.text.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length === 1 && STOPWORDS.has(words[0])) return false;
      return LOCAL_RULES.some((rule) => scoreRule(item.text, rule) > 0);
    });
}

function mapToField(type) {
  return {
    PRODUCT_NAME: "productName", BRAND: "brandName", MRP: "mrp", NET_QUANTITY: "netQuantity",
    MANUFACTURER: "manufacturer", PACKER: "packer", MARKETER: "manufacturer", IMPORTER: "importer",
    BATCH_NUMBER: "batchNumber", DATE_OF_MANUFACTURE: "dateOfManufacture", DATE_OF_PACKING: "dateOfPacking",
    BEST_BEFORE: "bestBefore", EXPIRY_DATE: "expiryDate", CONSUMER_CARE: "consumerCarePhone", COUNTRY_OF_ORIGIN: "countryOfOrigin",
    FSSAI_LICENSE: "fssaiLicenseNumber", BARCODE: "barcode", ADDRESS: "manufacturerAddress",
  }[type];
}

function fieldObject() {
  return { value: null, raw: null, confidence: 0, evidence: null, status: "absent" };
}

function buildFields(mappings) {
  const fields = {};
  const keys = ["productName","brandName","manufacturer","manufacturerAddress","packer","packerAddress","importer","importerAddress","netQuantity","unit","mrp","currency","dateOfManufacture","dateOfPacking","bestBefore","expiryDate","batchNumber","consumerCarePhone","consumerCareEmail","countryOfOrigin","fssaiLicenseNumber","barcode"];
  keys.forEach((key) => { fields[key] = fieldObject(); });

  for (const mapping of mappings) {
    const key = mapToField(mapping.type);
    if (!key || fields[key].status === "found") continue;
    const rawValue = mapping.text;
    let value = mapping.value || rawValue;
    if (mapping.type === "MRP") value = Number(String(value).replace(/[^0-9.]/g, "")) || value;
    if (mapping.type === "NET_QUANTITY") {
      const match = String(value).match(/^([0-9.]+)\s+([A-Za-z]+)$/);
      if (match) { fields.netQuantity.value = Number(match[1]); fields.unit.value = match[2]; fields.unit.raw = rawValue; fields.unit.evidence = rawValue; fields.unit.confidence = mapping.confidenceValue; fields.unit.status = "found"; }
    }
    fields[key] = { value, raw: rawValue, confidence: mapping.confidenceValue, evidence: rawValue, status: "found", imageIndex: mapping.imageIndex };
  }
  return fields;
}

function makeMapping(local, type, confidence, source) {
  const candidate = local.candidate;
  const confidenceValue = confidence === "HIGH" ? Math.max(0.86, candidate.confidence || 0.86) : confidence === "MEDIUM" ? 0.65 : 0.45;
  return { id: candidate.id, imageIndex: candidate.imageIndex, type, text: candidate.text, value: local.value || extractValue(type, candidate.text), confidence, confidenceValue, source, boundingBox: candidate.boundingBox || null };
}

export function runLocalMapper(evidence) {
  const selected = selectCandidates(evidence);
  const mappings = [];
  const needsLlm = [];
  const ignoredCount = Math.max(0, evidence.length - selected.length);

  for (const candidate of selected) {
    const result = classifyLocal(candidate);
    if (result.state === "LOCAL_CONFIDENT" || result.state === "LOCAL_PLAUSIBLE") mappings.push(makeMapping(result, result.type, result.confidence, "LOCAL"));
    else needsLlm.push({ candidate, reason: result.state, candidates: (result.candidates || []).map((entry) => entry.rule.type) });
  }

  return { mappings, needsLlm, selectedCount: selected.length, ignoredCount };
}

const LLM_SYSTEM_PROMPT = `You are PARAKH's semantic declaration classifier. You receive OCR lines that are already localized. Classify ONLY the listed candidate OCR lines into one of the allowed declaration types. Never invent text, values, image indexes, or coordinates. Do not classify decorative, promotional, nutritional, marketing, ingredient, or other non-declaration text unless the candidate clearly fits an allowed type. Prefer the most specific role phrase: Manufactured by=MANUFACTURER, Packed by=PACKER, Marketed by=MARKETER, Imported by=IMPORTER. For Best before/Use within/Shelf life, classify BEST_BEFORE even if MFD appears later as a reference anchor. Return only mappings for candidates you are reasonably confident are needed declarations.`;

const LLM_SCHEMA = {
  type: "object",
  properties: {
    mappings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: DECLARATION_TYPES },
          value: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        },
        required: ["id", "type", "value", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["mappings"],
  additionalProperties: false,
};

function compactCandidates(items) {
  return items.map(({ candidate, reason, candidates }) => ({ id: candidate.id, imageIndex: candidate.imageIndex, text: candidate.text, bbox: candidate.boundingBox, reason, localCandidates: candidates }));
}

async function callGemini(items, config) {
  if (!config.geminiApiKey) throw new Error("Gemini semantic mapper is not configured.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(config.semanticTimeoutMs),
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${LLM_SYSTEM_PROMPT}\n\nCandidates:\n${JSON.stringify(compactCandidates(items))}` }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: LLM_SCHEMA, maxOutputTokens: 1800 } }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini semantic mapping failed (${response.status}).`);
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const parsed = LlmResultSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("Gemini semantic mapper returned invalid schema.");
  return parsed.data.mappings.map((mapping) => ({ ...mapping, source: "GEMINI" }));
}

async function callOpenAI(items, config) {
  if (!config.openaiApiKey) throw new Error("OpenAI semantic mapper is not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openaiApiKey}` },
    signal: AbortSignal.timeout(config.semanticTimeoutMs),
    body: JSON.stringify({
      model: config.openaiSemanticModel,
      input: [
        { role: "system", content: [{ type: "input_text", text: LLM_SYSTEM_PROMPT }] },
        { role: "user", content: [{ type: "input_text", text: `Candidates:\n${JSON.stringify(compactCandidates(items))}` }] },
      ],
      text: { format: { type: "json_schema", name: "parakh_semantic_mappings", strict: true, schema: LLM_SCHEMA } },
      temperature: 0,
      max_output_tokens: 1800,
      store: false,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI semantic mapping failed (${response.status}).`);
  const text = data?.output_text || "";
  const parsed = LlmResultSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("OpenAI semantic mapper returned invalid schema.");
  return parsed.data.mappings.map((mapping) => ({ ...mapping, source: "OPENAI" }));
}

export async function runSemanticMapper(evidence, config) {
  const local = runLocalMapper(evidence);
  let llmMappings = [];
  let llmProvider = null;
  let llmError = null;

  if (local.needsLlm.length) {
    const providers = config.semanticProvider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
    for (const provider of providers) {
      try {
        llmMappings = provider === "gemini" ? await callGemini(local.needsLlm, config) : await callOpenAI(local.needsLlm, config);
        llmProvider = provider;
        llmError = null;
        break;
      } catch (error) {
        llmError = error.message;
      }
    }
  }

  const byId = new Map(evidence.map((item) => [String(item.id), item]));
  const acceptedLlm = llmMappings.map((mapping) => {
    const candidate = byId.get(String(mapping.id));
    if (!candidate) return null;
    const localLike = { candidate, value: mapping.value };
    return makeMapping(localLike, mapping.type, mapping.confidence, mapping.source);
  }).filter(Boolean);

  const allMappings = [...local.mappings, ...acceptedLlm].filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index);
  allMappings.sort((a, b) => a.imageIndex - b.imageIndex || (a.boundingBox?.top || 0) - (b.boundingBox?.top || 0) || (a.boundingBox?.left || 0) - (b.boundingBox?.left || 0));

  const declarationEvidence = allMappings.map((item) => ({ imageIndex: item.imageIndex + 1, type: item.type, text: item.text, confidence: item.confidenceValue, boundingBox: item.boundingBox, source: item.source }));
  const rawText = evidence.map((item) => `[IMAGE ${Number(item.imageIndex) + 1}] ${item.text}`).join("\n");
  const fields = buildFields(allMappings);
  return {
    ...fields,
    declarationEvidence,
    otherDeclarations: [],
    rawText,
    warnings: llmError && local.mappings.length ? [`LLM semantic mapper unavailable: ${llmError}`] : [],
    unreadableFields: [],
    needsReview: Boolean(llmError && local.needsLlm.length),
    semantic: { provider: llmProvider || "local", localCandidates: local.selectedCount, ignoredTextLines: local.ignoredCount, llmCandidates: local.needsLlm.length, llmUsed: acceptedLlm.length, llmError },
  };
}
