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
  { type: "MANUFACTURER", priority: 98, patterns: [/\b(?:mfd|mfg)\.?\s*by\b/i, /\bmanufactured\s+by\b/i, /\bmanufacturer\b/i] },
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
const BRAND_NOISE = new Set(["india", "indian", "bharat", "foods", "food", "limited", "ltd", "pvt", "private", "company", "companies", "products", "product", "industries", "industry", "corporation", "corp", "manufacturing", "manufacturer", "marketed", "packaged", "wellness"]);
const CLAIM_WORDS = /\b(?:tightens?|fights?|gives?|protects?|prevents?|removes?|reduces?|controls?|treats?|helps?|improves?|strengthens?|whitens?|freshens?|cleans?|purifies?|repels?|restores?|supports?|boosts?|enhances?|long\s+life|strong\s+teeth|healthy\s+gums?|gum\s+care|germ\s+protection|germ\s+fight|fresh\s+breath)\b/i;
const LEGAL_OR_INSTRUCTION = /^(?:for|visit|toll|e-?mail|made\s+in|store\s+in|for\s+sale|marketed|manufactured|mfd|mfg|packed|pkd|imported|consumer|customer|country|address|ingredients?|nutrition|net|best|use|mrp|batch|barcode|license|manufacturing|division|regd|registered)\b/i;
const PRODUCT_HINTS = /\b(?:biscuits?|cookies?|namkeen|chips?|snacks?|noodles?|atta|flour|rice|dal|pulses?|spices?|masala|tea|coffee|juice|drink|beverage|soap|shampoo|detergent|oil|ghee|butter|milk|curd|yogurt|chocolate|candy|toffee|salt|sugar|sauce|ketchup|paste|powder|cream|wafer|wafers?|toothpaste|tooth\s*powder|dental|dentifrice|gum|gums|ayurvedic)\b/i;

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u00a0\t]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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

function isGenericBoilerplate(text) {
  const source = normalizeText(text);
  if (!source) return true;
  if (source.length > 80 || /\d/.test(source)) return true;
  if (LOCAL_RULES.some((rule) => ruleScore(source, rule) > 0)) return true;
  if (LEGAL_OR_INSTRUCTION.test(source)) return true;
  if (CLAIM_WORDS.test(source)) return true;
  if (/^(?:save|offer|free|new|original|natural|pure|premium|best|number|no)\b/i.test(source) && source.split(/\s+/).length <= 4) return true;
  return false;
}

function looksLikeBrand(text) {
  const source = normalizeText(text);
  const lower = source.toLowerCase();
  if (!source || BRAND_NOISE.has(lower) || isGenericBoilerplate(source)) return false;
  return source.length >= 3 && /[A-Za-z]/.test(source) && source.split(/\s+/).length <= 4;
}

function getBoxMetrics(candidate, candidates) {
  const boxes = candidates.map((item) => item.boundingBox).filter(Boolean).map((box) => ({ width: Number(box.width) || 0, height: Number(box.height) || 0 }));
  const box = candidate.boundingBox;
  if (!box) return { areaRatio: 0, heightRatio: 0, widthRatio: 0 };
  const width = Math.max(0, Number(box.width) || 0);
  const height = Math.max(0, Number(box.height) || 0);
  const area = width * height;
  const maxArea = Math.max(1, ...boxes.map((item) => item.width * item.height));
  const maxHeight = Math.max(1, ...boxes.map((item) => item.height));
  const maxWidth = Math.max(1, ...boxes.map((item) => item.width));
  return { areaRatio: area / maxArea, heightRatio: height / maxHeight, widthRatio: width / maxWidth };
}

function brandScore(candidate, candidates) {
  const text = normalizeText(candidate.text);
  if (!looksLikeBrand(text)) return -1;
  const metrics = getBoxMetrics(candidate, candidates);
  let score = 20;
  if (text === text.toUpperCase()) score += 18;
  if (/^[A-Z][A-Za-z0-9&' .-]{2,35}$/.test(text)) score += 8;
  if (metrics.areaRatio >= 0.75) score += 18;
  else if (metrics.areaRatio >= 0.5) score += 10;
  if (metrics.heightRatio >= 0.75) score += 10;
  if (candidate.confidence >= 0.9) score += 8;
  else if (candidate.confidence >= 0.75) score += 4;
  if (PRODUCT_HINTS.test(text)) score -= 10;
  return score;
}

function productNameScore(candidate, candidates) {
  const text = normalizeText(candidate.text);
  if (!text || isGenericBoilerplate(text)) return -1;
  const metrics = getBoxMetrics(candidate, candidates);
  let score = 20;
  if (metrics.areaRatio >= 0.8) score += 50;
  else if (metrics.areaRatio >= 0.6) score += 35;
  else if (metrics.areaRatio >= 0.4) score += 20;
  if (metrics.heightRatio >= 0.8) score += 25;
  else if (metrics.heightRatio >= 0.6) score += 15;
  if (text === text.toUpperCase()) score += 8;
  if (/^[A-Za-z][A-Za-z0-9&' .-]{2,60}$/.test(text)) score += 5;
  if (PRODUCT_HINTS.test(text)) score += 10;
  if (CLAIM_WORDS.test(text)) score -= 50;
  if (/\b(?:manager|division|office|road|district|centre|license|limited|ltd|private|foods)\b/i.test(text)) score -= 30;
  if (candidate.confidence >= 0.85) score += 5;
  return score;
}

function makeInferredMappings(candidates, existingMappings) {
  const mappings = [];
  if (!existingMappings.some((item) => item.type === "PRODUCT_NAME")) {
    const bestProduct = [...candidates]
      .map((candidate) => ({ candidate, score: productNameScore(candidate, candidates) }))
      .sort((a, b) => b.score - a.score)[0];
    if (bestProduct && bestProduct.score >= 45) {
      mappings.push(makeMapping(bestProduct.candidate, "PRODUCT_NAME", "LAYOUT_HEURISTIC", bestProduct.candidate.text, bestProduct.score >= 80 ? "MEDIUM" : "LOW", Math.min(0.86, 0.38 + bestProduct.score / 100)));
    }
  }
  if (!existingMappings.some((item) => item.type === "BRAND")) {
    const bestBrand = [...candidates]
      .map((candidate) => ({ candidate, score: brandScore(candidate, candidates) }))
      .sort((a, b) => b.score - a.score)[0];
    if (bestBrand && bestBrand.score >= 40) {
      mappings.push(makeMapping(bestBrand.candidate, "BRAND", "LAYOUT_HEURISTIC", bestBrand.candidate.text, bestBrand.score >= 70 ? "MEDIUM" : "LOW", Math.min(0.82, 0.4 + bestBrand.score / 100)));
    }
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
  const timeoutMs = Number(process.env.GLINER_TIMEOUT_MS || "8000");
  const response = await fetch(`${url}/map`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(timeoutMs), body: JSON.stringify({ candidates }) });
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
  const semanticCandidates = Array.from(new Map(unresolved.map((item) => [`${item.imageIndex}:${normalizeText(item.text).toLowerCase()}`, item])).values()).slice(0, Number(process.env.GLINER_MAX_CANDIDATES || "16"));
  let glinerMappings = [];
  let glinerError = null;
  if (semanticCandidates.length && semanticCandidates.some((candidate) => !candidate.text.match(/^(?:for|visit us|toll free|made in|store in|for sale|mfg|mfd|marketed|manufactured|packed|imported)\b/i))) {
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
