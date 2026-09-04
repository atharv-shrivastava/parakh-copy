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
  { type: "DATE_OF_MANUFACTURE", priority: 88, patterns: [/\b(?:mfd|mfg)\.?\s*(?:date|dt)\b/i, /\bdate\s+of\s+(?:manufacture|manufacturing)\b/i, /\bmanufactured\s+(?:on|date)\b/i] },
  { type: "DATE_OF_PACKING", priority: 86, patterns: [/\b(?:packed|packing|pkd)\s*(?:on|date)?\b/i] },
  { type: "BEST_BEFORE", priority: 100, patterns: [/\bbest\s*before\b/i, /\buse\s*within\b/i, /\bshelf\s*life\b/i] },
  { type: "EXPIRY_DATE", priority: 99, patterns: [/\b(?:expiry|expires|exp\.?)\b/i, /\buse\s*by\b/i] },
  { type: "MANUFACTURER", priority: 98, patterns: [/\b(?:mfd|mfg)\.?\s*by\b/i, /\bmanufactured\s+by\b/i, /\bmanufactured\s+(?:for|at)\b/i, /\bmanufacturer\b/i] },
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
const BRAND_NOISE = new Set(["india", "indian", "foods", "food", "limited", "ltd", "pvt", "private", "company", "companies", "products", "product", "industries", "industry", "corporation", "corp", "manufacturing", "manufacturer", "marketed", "packaged"]);
const PRODUCT_HINTS = /\b(?:biscuits?|cookies?|namkeen|chips?|snacks?|noodles?|atta|flour|rice|dal|pulses?|spices?|masala|tea|coffee|juice|drink|beverage|soap|shampoo|detergent|oil|ghee|butter|milk|curd|yogurt|chocolate|candy|toffee|salt|sugar|sauce|ketchup|paste|powder|cream|wafer|wafers?|toothpaste|tooth\s*powder|dental|dentifrice|gum|gums|ayurvedic)\b/i;

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

const RELEVANCE_PATTERNS = [
  /\b(?:mrp|m\.?r\.?p|maximum retail price|net (?:qty|quantity|weight|volume)|batch|lot|mfd|mfg|manufactur(?:ed|er|ing)|packed|pkd|packer|marketed|marketer|imported|importer|best before|use by|expiry|exp\.?|consumer care|customer care|helpline|country of origin|made in|fssai|license|barcode|ean|upc|gtin)\b/i,
  /(?:₹|rs\.?|inr)\s*[0-9oOlI]{1,6}/i,
  /\b[0-9]{8,14}\b/,
  /\b[0-9]{1,6}\s*(?:mg|g|kg|ml|l|cl|oz|lb)\b/i,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+[0-9]{2,4}\b/i,
];

function isRelevantSemanticCandidate(candidate) {
  const text = normalizeText(candidate.text);
  if (!text) return false;
  if (/^for\s+batch\s+no\.?[\s,].*(?:refer|inside|details)/i.test(text)) return false;
  return RELEVANCE_PATTERNS.some((pattern) => pattern.test(text));
}

function extractValue(type, text) {
  const source = normalizeText(text);
  if (type === "MRP") return source.match(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)/i)?.[1]?.replace(/,/g, "") || source;
  if (type === "NET_QUANTITY") {
    const matches = [...source.matchAll(/([0-9][0-9,.]*)\s*(mg|g|kg|ml|l|cl|oz|lb)\b/gi)];
    if (!matches.length) return source;
    const match = /\bnet\s*(?:qty|quantity|weight|volume)\b/i.test(source) ? matches[matches.length - 1] : matches[0];
    return `${match[1].replace(/,/g, "")} ${match[2]}`;
  }
  const roleMatch = source.match(/(?:manufactured|mfd|mfg|packed|pkd|marketed|imported)\.?\s+by\s*[:\-]?\s*(.+)$/i);
  if (roleMatch) return roleMatch[1].trim();
  const labeledMatch = source.match(/\b(?:manufacturer|packer|marketer|importer)\s*[:\-]\s*(.+)$/i);
  if (labeledMatch) return labeledMatch[1].trim();
  return source;
}

function looksLikeBrand(text) {
  const source = normalizeText(text);
  const lower = source.toLowerCase();
  if (!source || BRAND_NOISE.has(lower)) return false;
  if (source.length > 60 || /\d/.test(source)) return false;
  if (LOCAL_RULES.some((rule) => ruleScore(source, rule) > 0)) return false;
  if (/^(?:made|with|containing|ingredients?|nutrition|net|best|use|mrp|batch|mfd|mfg|packed|marketed|imported|country|address|www)\b/i.test(source)) return false;
  return source.length >= 3 && /[A-Za-z]/.test(source);
}

function brandScore(candidate, candidates) {
  const text = normalizeText(candidate.text);
  if (!looksLikeBrand(text)) return -1;
  let score = 15;
  if (text === text.toUpperCase()) score += 25;
  if (/^[A-Z][A-Za-z0-9&' .-]{2,35}$/.test(text)) score += 10;
  const sameImage = candidates.filter((item) => item.imageIndex === candidate.imageIndex && item.id !== candidate.id);
  const relativeY = candidate.boundingBox ? (Number(candidate.boundingBox.top) || 0) : null;
  if (candidate.boundingBox) {
    const width = Math.max(0, Number(candidate.boundingBox.width) || 0);
    const height = Math.max(0, Number(candidate.boundingBox.height) || 0);
    const area = width * height;
    if (area > 25000 || width >= 300 || height >= 80) score += 20;
    else if (area > 8000 || width >= 180 || height >= 55) score += 10;
    if (relativeY !== null && relativeY <= 0.35 * Math.max(1, Math.max(...sameImage.map((item) => Number(item.boundingBox?.top) || 0), relativeY))) score += 8;
  }
  if (candidate.confidence >= 0.9) score += 10;
  else if (candidate.confidence >= 0.75) score += 5;
  if (PRODUCT_HINTS.test(text)) score -= 12;
  return score;
}

function looksLikeProduct(text) {
  const source = normalizeText(text);
  if (!source || source.length > 80 || /\b(?:mrp|batch|mfd|mfg|best before|expiry|manufactured by|packed by|marketed by|imported by)\b/i.test(source)) return false;
  return PRODUCT_HINTS.test(source);
}

function productScore(candidate) {
  const text = normalizeText(candidate.text);
  if (!looksLikeProduct(text)) return -1;
  let score = 10;
  if (/^[A-Z][A-Za-z0-9&' .-]{3,50}$/.test(text)) score += 10;
  if (text === text.toUpperCase()) score += 10;
  if (candidate.confidence >= 0.85) score += 10;
  return score;
}

function makeInferredMappings(candidates, existingMappings) {
  const mappings = [];
  if (!existingMappings.some((item) => item.type === "BRAND")) {
    const bestBrand = [...candidates].map((candidate) => ({ candidate, score: brandScore(candidate, candidates) })).sort((a, b) => b.score - a.score)[0];
    if (bestBrand && bestBrand.score >= 35) mappings.push(makeMapping(bestBrand.candidate, "BRAND", "LAYOUT_HEURISTIC", bestBrand.candidate.text, bestBrand.score >= 55 ? "MEDIUM" : "LOW", Math.min(0.82, 0.42 + bestBrand.score / 100)));
  }
  if (!existingMappings.some((item) => item.type === "PRODUCT_NAME")) {
    const bestProduct = [...candidates].map((candidate) => ({ candidate, score: productScore(candidate) })).sort((a, b) => b.score - a.score)[0];
    if (bestProduct && bestProduct.score >= 18) mappings.push(makeMapping(bestProduct.candidate, "PRODUCT_NAME", "LAYOUT_HEURISTIC", bestProduct.candidate.text, "LOW", Math.min(0.72, 0.42 + bestProduct.score / 100)));
  }
  return mappings;
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
  const response = await fetch(`${url}/map`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(Number(process.env.GLINER_TIMEOUT_MS || "15000")), body: JSON.stringify({ candidates }) });
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
    else if (isRelevantSemanticCandidate(candidate)) unresolved.push(candidate);
  }
  const semanticCandidates = Array.from(new Map(unresolved.map((item) => [`${item.imageIndex}:${normalizeText(item.text).toLowerCase()}`, item])).values()).slice(0, Number(process.env.GLINER_MAX_CANDIDATES || "24"));
  let glinerMappings = [];
  let glinerError = null;
  if (semanticCandidates.length) {
    try { glinerMappings = await glinerMap(semanticCandidates); } catch (error) { glinerError = error.message; }
  }
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const acceptedGliner = glinerMappings.map((mapping) => { const candidate = byId.get(String(mapping.id)); return candidate ? makeMapping(candidate, mapping.type, "GLINER2", mapping.value || mapping.text, mapping.confidence, mapping.confidenceValue) : null; }).filter(Boolean);
  const baseMappings = [...localMappings, ...acceptedGliner].filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index);
  const inferredMappings = makeInferredMappings(candidates, baseMappings);
  const mappings = [...baseMappings, ...inferredMappings].filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index).sort((a, b) => a.imageIndex - b.imageIndex || (a.boundingBox?.top || 0) - (b.boundingBox?.top || 0) || (a.boundingBox?.left || 0) - (b.boundingBox?.left || 0));
  const mappedIds = new Set(mappings.map((item) => item.id));
  const declarationEvidence = mappings.map((item) => ({ imageIndex: item.imageIndex + 1, type: item.type, text: item.text, confidence: item.confidenceValue, boundingBox: item.boundingBox, source: item.source }));
  const otherDeclarations = candidates.filter((item) => !mappedIds.has(item.id) && !STOPWORDS.has(item.text.toLowerCase())).map((item) => ({ imageIndex: item.imageIndex + 1, text: item.text, confidence: item.confidence }));
  const fields = buildFields(mappings);
  const foundCount = Object.values(fields).filter((field) => field && typeof field === "object" && field.status === "found").length;
  return { ...fields, declarationEvidence, otherDeclarations, rawText: candidates.map((item) => item.text).join("\n"), warnings: glinerError ? [glinerError] : [], unreadableFields: [], needsReview: false, semantic: { provider: glinerMappings.length ? "gliner2-local" : inferredMappings.length ? "local-rules+layout" : "local-rules", mappedFields: foundCount, glinerError } };
}

function localClassification(candidate) {
  const scored = LOCAL_RULES.map((rule) => ({ rule, score: ruleScore(candidate.text, rule) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored[1] && scored[0].score - scored[1].score < 7) return null;
  const best = scored[0];
  const confidence = best.score >= 95 ? "HIGH" : best.score >= 84 ? "MEDIUM" : "LOW";
  return { type: best.rule.type, value: extractValue(best.rule.type, candidate.text), confidence, confidenceValue: confidence === "HIGH" ? Math.max(0.86, candidate.confidence) : confidence === "MEDIUM" ? Math.max(0.65, candidate.confidence) : Math.max(0.45, candidate.confidence) };
}
