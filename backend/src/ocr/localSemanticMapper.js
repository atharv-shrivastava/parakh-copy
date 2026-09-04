import { z } from "zod";

export const DECLARATION_TYPES = [
  "PRODUCT_NAME", "BRAND", "MRP", "NET_QUANTITY", "MANUFACTURER", "PACKER", "MARKETER", "IMPORTER",
  "ADDRESS", "BATCH_NUMBER", "DATE_OF_MANUFACTURE", "DATE_OF_PACKING", "BEST_BEFORE", "EXPIRY_DATE",
  "CONSUMER_CARE", "COUNTRY_OF_ORIGIN", "FSSAI_LICENSE", "BARCODE",
];

const GlinerResponseSchema = z.object({
  mappings: z.array(z.object({
    id: z.string(), imageIndex: z.number().int().min(0), type: z.enum(DECLARATION_TYPES), text: z.string().min(1),
    value: z.string().nullable().optional(), confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    confidenceValue: z.number().min(0).max(1).optional(), boundingBox: z.object({ left: z.number(), top: z.number(), width: z.number(), height: z.number() }).nullable().optional(),
    source: z.string().optional(),
  })).default([]),
});

const LOCAL_RULES = [
  { type: "MRP", priority: 100, patterns: [/\bm\.?r\.?p\.?\b/i, /maximum\s+retail\s+price/i, /₹\s*[0-9oOlI]{1,6}(?:[.,][0-9]{1,2})?/i, /(?:rs\.?|inr)\s*[0-9oOlI]{1,6}(?:[.,][0-9]{1,2})?/i] },
  { type: "NET_QUANTITY", priority: 95, patterns: [/\bnet\s*(?:qty|quantity|weight|volume)\b/i, /\b(?:[0-9oOlI]{1,6}(?:[.,][0-9]{1,3})?)\s*(?:g|kg|mg|ml|l|cl|oz|lb)\b/i] },
  { type: "BATCH_NUMBER", priority: 90, patterns: [/\b(?:batch|lot)\s*(?:no|number|#|code)?\b/i, /\bb\.?\s*no\.?\b/i] },
  { type: "DATE_OF_MANUFACTURE", priority: 88, patterns: [/\b(?:mfd|mfg|manufactured)\b/i, /\bmanufactur(?:ed|e|ing)\s*(?:on|date)?\b/i] },
  { type: "DATE_OF_PACKING", priority: 86, patterns: [/\b(?:packed|packing|pkd)\s*(?:on|date)?\b/i] },
  { type: "BEST_BEFORE", priority: 100, patterns: [/\bbest\s*before\b/i, /\buse\s*within\b/i, /\bshelf\s*life\b/i] },
  { type: "EXPIRY_DATE", priority: 99, patterns: [/\b(?:expiry|expires|exp\.?)\b/i, /\buse\s*by\b/i] },
  { type: "MANUFACTURER", priority: 96, patterns: [/\bmanufactured\s+by\b/i, /\bmanufactured\s+(?:for|at)\b/i, /\bmanufacturer\b/i] },
  { type: "PACKER", priority: 94, patterns: [/\bpacked\s+by\b/i, /\bpacker\b/i] },
  { type: "MARKETER", priority: 94, patterns: [/\bmarketed\s+by\b/i, /\bmarketer\b/i, /\bmarketed\b/i] },
  { type: "IMPORTER", priority: 94, patterns: [/\bimported\s+by\b/i, /\bimporter\b/i] },
  { type: "CONSUMER_CARE", priority: 82, patterns: [/\bcustomer\s*care\b/i, /\bconsumer\s*care\b/i, /\bhelpline\b/i, /\btoll\s*free\b/i] },
  { type: "COUNTRY_OF_ORIGIN", priority: 82, patterns: [/\bcountry\s+of\s+origin\b/i, /\bmade\s+in\b/i, /\bproduct\s+of\b/i] },
  { type: "FSSAI_LICENSE", priority: 88, patterns: [/\bfssai\b/i, /\blic(?:ense|ence)\s*(?:no|number)?\b/i] },
  { type: "BARCODE", priority: 78, patterns: [/\b(?:barcode|bar\s*code|ean|upc|gtin)\b/i, /\b[0-9]{8,14}\b/] },
  { type: "ADDRESS", priority: 55, patterns: [/\b(?:address|road|rd\.?|street|st\.?|nagar|district|dist\.?|pin\s*code|pincode)\b/i] },
];

const STOPWORDS = new Set(["and", "or", "the", "with", "for", "from", "this", "that", "pack", "quality", "premium", "since", "www", "com"]);

function normalizeText(value) {
  return String(value || "").replace(/[\u00a0\t]+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

function canonical(text) {
  return normalizeText(text).replace(/[₹]/g, " rs ").replace(/[|]/g, "I").replace(/\bM\s*R\s*P\b/gi, "MRP").toLowerCase();
}

function ruleScore(text, rule) {
  const source = canonical(text);
  const hits = rule.patterns.filter((pattern) => pattern.test(source));
  return hits.length ? rule.priority + Math.min(12, Math.max(...hits.map((pattern) => String(pattern).length / 8))) : 0;
}

function extractValue(type, text) {
  const source = normalizeText(text);
  if (type === "MRP") return source.match(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)/i)?.[1]?.replace(/,/g, "") || source;
  if (type === "NET_QUANTITY") {
    const match = source.match(/([0-9][0-9,.]*)\s*(mg|g|kg|ml|l|cl|oz|lb)\b/i);
    return match ? `${match[1].replace(/,/g, "")} ${match[2]}` : source;
  }
  return source;
}

function localClassification(candidate) {
  const scored = LOCAL_RULES.map((rule) => ({ rule, score: ruleScore(candidate.text, rule) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored[1] && scored[0].score - scored[1].score < 7) return null;
  const best = scored[0];
  const confidence = best.score >= 95 ? "HIGH" : best.score >= 84 ? "MEDIUM" : "LOW";
  return { type: best.rule.type, value: extractValue(best.rule.type, candidate.text), confidence, confidenceValue: confidence === "HIGH" ? Math.max(0.86, candidate.confidence) : confidence === "MEDIUM" ? Math.max(0.65, candidate.confidence) : Math.max(0.45, candidate.confidence) };
}

function makeMapping(candidate, type, source, value, confidence, confidenceValue) {
  return { id: candidate.id, imageIndex: candidate.imageIndex, type, text: candidate.text, value: value || extractValue(type, candidate.text), confidence, confidenceValue, source, boundingBox: candidate.boundingBox || null };
}

function mapToField(type) {
  return { PRODUCT_NAME: "productName", BRAND: "brandName", MRP: "mrp", NET_QUANTITY: "netQuantity", MANUFACTURER: "manufacturer", PACKER: "packer", MARKETER: "marketer", IMPORTER: "importer", BATCH_NUMBER: "batchNumber", DATE_OF_MANUFACTURE: "dateOfManufacture", DATE_OF_PACKING: "dateOfPacking", BEST_BEFORE: "bestBefore", EXPIRY_DATE: "expiryDate", CONSUMER_CARE: "consumerCarePhone", COUNTRY_OF_ORIGIN: "countryOfOrigin", FSSAI_LICENSE: "fssaiLicenseNumber", BARCODE: "barcode", ADDRESS: "manufacturerAddress" }[type];
}

function fieldObject() { return { value: null, raw: null, confidence: 0, evidence: null, status: "absent" }; }

function buildFields(mappings) {
  const fields = {};
  ["productName", "brandName", "manufacturer", "manufacturerAddress", "packer", "packerAddress", "marketer", "importer", "importerAddress", "netQuantity", "unit", "mrp", "currency", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate", "batchNumber", "consumerCarePhone", "consumerCareEmail", "countryOfOrigin", "fssaiLicenseNumber", "barcode"].forEach((key) => { fields[key] = fieldObject(); });
  for (const mapping of mappings) {
    const key = mapToField(mapping.type);
    if (!key || fields[key].status === "found") continue;
    let value = mapping.value || mapping.text;
    if (mapping.type === "MRP") value = Number(String(value).replace(/[^0-9.]/g, "")) || value;
    if (mapping.type === "NET_QUANTITY") {
      const match = String(value).match(/^([0-9.]+)\s+([A-Za-z]+)$/);
      if (match) {
        fields.netQuantity = { value: Number(match[1]), raw: mapping.text, confidence: mapping.confidenceValue, evidence: mapping.text, status: "found", imageIndex: mapping.imageIndex };
        fields.unit = { value: match[2], raw: mapping.text, confidence: mapping.confidenceValue, evidence: mapping.text, status: "found", imageIndex: mapping.imageIndex };
        continue;
      }
    }
    fields[key] = { value, raw: mapping.text, confidence: mapping.confidenceValue, evidence: mapping.text, status: "found", imageIndex: mapping.imageIndex };
  }
  return fields;
}

async function glinerMap(candidates) {
  const url = process.env.GLINER_SERVICE_URL || "http://localhost:8091";
  const response = await fetch(`${url}/map`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(Number(process.env.GLINER_TIMEOUT_MS || "8000")), body: JSON.stringify({ candidates }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || data?.error || `GLiNER2 failed (${response.status})`);
  const parsed = GlinerResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error("GLiNER2 returned invalid schema");
  return parsed.data.mappings;
}

export async function runSemanticMapper(evidence) {
  const candidates = evidence.map((item, index) => ({ id: String(item.id ?? `${Math.max(0, Number(item.imageIndex) || 0)}:${index}`), imageIndex: Math.max(0, Number(item.imageIndex) || 0), text: normalizeText(item.text), confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)), boundingBox: item.boundingBox || null })).filter((item) => item.text);
  const localMappings = [];
  const unresolved = [];
  for (const candidate of candidates) {
    const local = localClassification(candidate);
    if (local) localMappings.push(makeMapping(candidate, local.type, "LOCAL_RULES", local.value, local.confidence, local.confidenceValue));
    else unresolved.push(candidate);
  }

  let glinerMappings = [];
  let glinerError = null;
  if (unresolved.length) {
    try { glinerMappings = await glinerMap(unresolved); } catch (error) { glinerError = error.message; }
  }

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const acceptedGliner = glinerMappings.map((mapping) => {
    const candidate = byId.get(String(mapping.id));
    return candidate ? makeMapping(candidate, mapping.type, "GLINER2", mapping.value || mapping.text, mapping.confidence, mapping.confidenceValue) : null;
  }).filter(Boolean);

  const mappings = [...localMappings, ...acceptedGliner].filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index).sort((a, b) => a.imageIndex - b.imageIndex || (a.boundingBox?.top || 0) - (b.boundingBox?.top || 0) || (a.boundingBox?.left || 0) - (b.boundingBox?.left || 0));
  const mappedIds = new Set(mappings.map((item) => item.id));
  const declarationEvidence = mappings.map((item) => ({ imageIndex: item.imageIndex + 1, type: item.type, text: item.text, confidence: item.confidenceValue, boundingBox: item.boundingBox, source: item.source }));
  const otherDeclarations = candidates.filter((item) => !mappedIds.has(item.id) && !STOPWORDS.has(item.text.toLowerCase())).map((item) => ({ imageIndex: item.imageIndex + 1, text: item.text, confidence: item.confidence, boundingBox: item.boundingBox }));

  return {
    ...buildFields(mappings),
    declarationEvidence,
    otherDeclarations,
    rawText: candidates.map((item) => `[IMAGE ${item.imageIndex + 1}] ${item.text}`).join("\n"),
    warnings: glinerError ? [`Local GLiNER2 unavailable: ${glinerError}`] : [],
    unreadableFields: [],
    needsReview: Boolean(glinerError && unresolved.length),
    semantic: { provider: acceptedGliner.length ? "gliner2-local" : "local-rules", localMapped: localMappings.length, glinerCandidates: unresolved.length, glinerUsed: acceptedGliner.length, glinerError },
  };
}
