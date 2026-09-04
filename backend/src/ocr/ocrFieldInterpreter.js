/**
 * Deterministic PaddleOCR field reconciler.
 * No Gemini, GLiNER, network calls, external models, or brand hardcoding.
 *
 * Pipeline:
 *   normalize -> classify/anchor -> spatial association -> field validation
 *   -> identity ranking -> cross-image reconciliation -> explicit uncertainty
 *
 * The module intentionally keeps raw OCR evidence attached to every field so
 * a human can review questionable extraction rather than receiving invented data.
 */

const FIELD_NAMES = [
  "productName", "brandName", "mrp", "netQuantity", "unit", "batchNumber",
  "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate",
  "manufacturer", "manufacturerAddress", "packer", "packerAddress",
  "marketer", "marketerAddress", "importer", "importerAddress",
  "consumerCarePhone", "consumerCareEmail", "countryOfOrigin",
  "fssaiLicenseNumber", "barcode",
];

const LABELS = {
  manufacturer: /\b(?:manufactured\s+by|mfd\.?\s*by|mfg\.?\s*by|manufacturer)\b/i,
  packer: /\b(?:packed\s+by|pkd\.?\s*by|packer)\b/i,
  marketer: /\b(?:marketed\s+by|marketer)\b/i,
  importer: /\b(?:imported\s+by|importer)\b/i,
};

const DATE_LABELS = {
  dateOfManufacture: /\b(?:date\s+of\s+(?:manufacture|manufacturing)|manufactured\s+(?:on|date)|mfd\.?\s*(?:date|dt)?|mfg\.?\s*(?:date|dt)?)\b/i,
  dateOfPacking: /\b(?:date\s+of\s+packing|packed\s+(?:on|date)|packing\s+(?:date|dt)|pkd\.?\s*(?:date|dt)?)\b/i,
  bestBefore: /\b(?:best\s*before|use\s*within|shelf\s*life)\b/i,
  expiryDate: /\b(?:expiry|expires|exp\.?)\s*(?:date|dt)?\b|\buse\s*by\b/i,
};

const MRP_LABEL_RE = /\b(?:m\.?\s*r\.?\s*p\.?|maximum\s+retail\s+price)\b/i;
const MRP_CURRENCY_RE = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)/i;
const MRP_BARE_RE = /\b([0-9]{1,5}(?:[.,][0-9]{1,2})?)\b/;
const QUANTITY_RE = /\b([0-9]+(?:[.,][0-9]+)?)\s*(mg|mcg|g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|ltrs|cl|oz|lb|pcs|pieces|piece|units?|nos)\b/i;
const BATCH_LABEL_RE = /\b(?:batch|lot|lot\.?\s*no|batch\.?\s*no|b\.?\s*no)\b/i;
const FSSAI_LABEL_RE = /\bfssai\b|food\s+safety\s+(?:license|licence|number|no)/i;
const BARCODE_LABEL_RE = /\b(?:barcode|bar\s*code|ean|upc|gtin)\b/i;
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{9}\b|(?:0[1-9]\d{2,4}[\s-]?)\d{6,8}\b/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const DATE_RE = /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s*[A-Za-z]{3,9}\s*\d{2,4}|[A-Za-z]{3,9}\s+\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}[\/\-.]\d{4})\b/i;
const ADDRESS_RE = /\b(?:road|rd\.?|street|st\.?|nagar|district|dist\.?|state|pin\s*code|pincode|village|taluka|tehsil|industrial\s+(?:area|estate)|sector|phase|building|floor|plot|lane|avenue|near|opposite|opp\.?|haridwar|uttarakhand|madhya\s+pradesh|delhi|mumbai|kolkata|bengaluru|hyderabad|ahmedabad|pune|jaipur|india)\b/i;
const ORGANIZATION_RE = /\b(?:limited|ltd\.?|private|pvt\.?|company|corporation|corp\.?|industr(?:y|ies)|foods?|pharma|laborator(?:y|ies)|ayurved|manufactur(?:er|ing))\b/i;
const PROMO_RE = /^(?:save\s*\d+|save\s+up\s+to|offer|special\s+offer|discount|cashback|buy\s+\d+|buy\s+one|get\s+one|free|flat|limited\s+offer|sale|prize|lucky\s+draw|scratch)\b|\b(?:save|discount|off)\s*\d+/i;
const CLAIM_RE = /\b(?:tightens?|fights?|protects?|prevents?|removes?|reduces?|controls?|treats?|helps?|improves?|strengthens?|whitens?|freshens?|cleans?|purifies?|restores?|supports?|boosts?|enhances?|nourishes?|repairs?|relieves?|cures?|heals?|soothes?|kills?|gives?|long\s+life|healthy\s+gums?|fresh\s+breath|germ\s+protection)\b/i;
const LEGAL_RE = /^(?:for|visit|toll|e-?mail|made\s+in|store\s+in|for\s+sale|marketed|manufactured|mfd|mfg|packed|pkd|imported|consumer|customer|country|address|ingredients?|nutrition|net|best|use|mrp|batch|barcode|license|licence|manager|regd|registered|division|office|helpline|complaint)\b/i;
const GENERIC_IDENTITY_RE = /^(?:india|indian|bharat|wellness|foods?|products?|premium|quality|natural|pure|original|new|best|herbal|ayurvedic|advanced|total\s+care|toothpaste|tooth\s+paste)$/i;
const PRODUCT_HINT_RE = /\b(?:toothpaste|tooth\s*powder|dentifrice|soap|shampoo|detergent|biscuits?|cookies?|namkeen|chips?|snacks?|noodles?|atta|flour|rice|dal|pulses?|spices?|masala|tea|coffee|juice|drink|beverage|oil|ghee|butter|milk|curd|yogurt|chocolate|candy|toffee|salt|sugar|sauce|ketchup|paste|powder|cream|wafer|wafers?|dental|gum|gums)\b/i;

function textOf(value) {
  return String(value ?? "")
    .replace(/[\u00a0\t]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function norm(value) {
  return textOf(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function confidenceOf(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.55;
  return n > 1 ? Math.max(0, Math.min(1, n / 100)) : Math.max(0, Math.min(1, n));
}

function normalizeBox(box) {
  if (!box || typeof box !== "object") return null;
  const left = Number(box.left ?? box.x);
  const top = Number(box.top ?? box.y);
  const width = Number(box.width);
  const height = Number(box.height);
  if (![left, top, width, height].every(Number.isFinite)) return null;
  return { left, top, width: Math.max(0, width), height: Math.max(0, height) };
}

function center(box) {
  return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
}

function distance(a, b) {
  const ca = center(a);
  const cb = center(b);
  return ca && cb ? Math.hypot(ca.x - cb.x, ca.y - cb.y) : Number.POSITIVE_INFINITY;
}

function verticalGap(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.max(a.top, b.top) - Math.min(a.top + a.height, b.top + b.height));
}

function horizontalGap(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.max(a.left, b.left) - Math.min(a.left + a.width, b.left + b.width));
}

function verticalOverlap(a, b) {
  if (!a || !b) return 0;
  const overlap = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return overlap / Math.max(1, Math.min(a.height, b.height));
}

function horizontalOverlap(a, b) {
  if (!a || !b) return 0;
  const overlap = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
  return overlap / Math.max(1, Math.min(a.width, b.width));
}

function levenshteinSimilarity(a, b) {
  const left = norm(a).replace(/\s+/g, "");
  const right = norm(b).replace(/\s+/g, "");
  if (!left || !right) return 0;
  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return 1 - prev[right.length] / Math.max(left.length, right.length);
}

function numericCleanup(value) {
  return textOf(value)
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Zz]/g, "2");
}

function isDateLike(value) {
  return DATE_RE.test(textOf(value));
}

function parseNumeric(value) {
  const normalized = numericCleanup(value).replace(/,/g, "");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function isValidEAN(value) {
  const digits = numericCleanup(value).replace(/\D/g, "");
  if (digits.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10 === Number(digits[12]);
  }
  if (digits.length === 8) {
    let sum = 0;
    for (let i = 0; i < 7; i += 1) sum += Number(digits[i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === Number(digits[7]);
  }
  return digits.length === 12 || digits.length === 14;
}

function gtinDigits(value) {
  const digits = numericCleanup(value).replace(/\D/g, "");
  return /^\d{8,14}$/.test(digits) ? digits : null;
}

function cleanDetection(item, index) {
  const text = textOf(item?.text);
  if (!text) return null;
  return {
    id: String(item?.id ?? `det-${index}`),
    text,
    normalized: norm(text),
    confidence: confidenceOf(item?.confidence),
    boundingBox: normalizeBox(item?.boundingBox),
    imageIndex: Number.isInteger(item?.imageIndex) ? item.imageIndex : 0,
    index,
  };
}

function prepareDetections(detections) {
  const seen = new Set();
  return (Array.isArray(detections) ? detections : [])
    .map(cleanDetection)
    .filter(Boolean)
    .filter((item) => {
      const boxKey = item.boundingBox
        ? `${Math.round(item.boundingBox.left)}:${Math.round(item.boundingBox.top)}:${Math.round(item.boundingBox.width)}:${Math.round(item.boundingBox.height)}`
        : `nobox:${item.index}`;
      const key = `${item.imageIndex}|${item.normalized}|${boxKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function field(value, confidence, evidence = [], status = null, extra = {}) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
  const c = Math.max(0, Math.min(1, Number(confidence) || 0));
  return {
    value: hasValue ? value : null,
    raw: evidence[0]?.text || null,
    confidence: hasValue ? c : 0,
    status: status || (hasValue ? (c >= 0.48 ? "found" : "ambiguous") : "not_detected"),
    evidence: evidence.map((item) => ({ id: item.id, text: item.text, confidence: item.confidence, imageIndex: item.imageIndex, boundingBox: item.boundingBox })),
    source: "LOCAL_DETERMINISTIC_RECONCILER",
    ...extra,
  };
}

function anchorTypes(item) {
  const text = item.text;
  const types = [];
  if (MRP_LABEL_RE.test(text)) types.push("mrp");
  if (QUANTITY_RE.test(text) || /\bnet\s*(?:qty|quantity|weight|volume|vol|wt)\b/i.test(text)) types.push("quantity");
  if (BATCH_LABEL_RE.test(text)) types.push("batch");
  if (FSSAI_LABEL_RE.test(text)) types.push("fssai");
  if (BARCODE_LABEL_RE.test(text)) types.push("barcode");
  for (const [key, regex] of Object.entries(DATE_LABELS)) if (regex.test(text)) types.push(key);
  for (const [key, regex] of Object.entries(LABELS)) if (regex.test(text)) types.push(key);
  return types;
}

function inlineValue(item, regex, group = 1) {
  const match = textOf(item.text).match(regex);
  return match ? textOf(match[group] ?? match[0]) : null;
}

function candidateScore(anchor, candidate, kind) {
  if (anchor.imageIndex !== candidate.imageIndex) return -Infinity;
  let score = candidate.confidence * 0.30;
  if (anchor.boundingBox && candidate.boundingBox) {
    const maxDistance = kind === "mrp" || kind === "quantity" ? 180 : 240;
    const d = distance(anchor.boundingBox, candidate.boundingBox);
    if (d > maxDistance) return -Infinity;
    score += Math.max(0, 0.40 * (1 - d / maxDistance));
    score += Math.min(0.18, verticalOverlap(anchor.boundingBox, candidate.boundingBox) * 0.18);
    score += Math.min(0.12, horizontalOverlap(anchor.boundingBox, candidate.boundingBox) * 0.12);
    const cAnchor = center(anchor.boundingBox);
    const cCandidate = center(candidate.boundingBox);
    if (cAnchor && cCandidate) {
      const toRight = cCandidate.x >= cAnchor.x;
      const below = cCandidate.y >= cAnchor.y;
      if (toRight) score += 0.10;
      if (below) score += 0.06;
    }
  } else {
    score -= 0.08;
  }
  return score;
}

function nearestValue(anchor, detections, regex, kind, transform = (v) => v) {
  const candidates = detections
    .filter((item) => item.id !== anchor.id && item.imageIndex === anchor.imageIndex)
    .map((item) => ({ item, match: inlineValue(item, regex, 1), score: candidateScore(anchor, item, kind) }))
    .filter((entry) => entry.match && Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const best = candidates[0];
  return { value: transform(best.match), item: best.item, score: best.score };
}

function collectInlineOrNearby(detections, anchors, regex, kind, transform = (v) => v) {
  for (const anchor of anchors) {
    const inline = inlineValue(anchor, regex, 1);
    if (inline) return { value: transform(inline), item: anchor, score: 0.92, inline: true };
  }
  const all = [];
  for (const anchor of anchors) {
    const nearby = nearestValue(anchor, detections, regex, kind, transform);
    if (nearby) all.push({ ...nearby, anchor });
  }
  return all.sort((a, b) => b.score - a.score)[0] || null;
}

function extractMRP(detections) {
  const anchors = detections.filter((item) => MRP_LABEL_RE.test(item.text));
  const currencyRegex = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)/i;
  const bareRegex = /\b([0-9]{1,5}(?:[.,][0-9]{1,2})?)\b/;
  const best = collectInlineOrNearby(detections, anchors, currencyRegex, "mrp", (v) => v.replace(/,/g, ""));
  if (best) {
    const numeric = parseNumeric(best.value);
    if (numeric !== null && numeric <= 100000) {
      const confidence = Math.min(0.98, 0.54 + best.score * 0.45);
      return field(best.value, confidence, [best.item, ...(best.anchor ? [best.anchor] : [])]);
    }
  }

  const bare = collectInlineOrNearby(detections, anchors, bareRegex, "mrp", (v) => v.replace(/,/g, ""));
  if (bare) {
    const value = parseNumeric(bare.value);
    const raw = bare.item.text;
    const suspiciousYear = /^\d{4}$/.test(String(value)) && !/(?:₹|rs\.?|inr)/i.test(raw);
    if (value !== null && value <= 100000 && !isDateLike(raw) && !suspiciousYear) {
      return field(String(value), Math.min(0.78, 0.36 + bare.score * 0.35), [bare.item, ...(bare.anchor ? [bare.anchor] : [])], "ambiguous");
    }
  }
  return field(null, 0);
}

function extractQuantity(detections) {
  const anchors = detections.filter((item) => /\bnet\s*(?:qty|quantity|weight|volume|vol|wt)\b/i.test(item.text));
  const qty = collectInlineOrNearby(detections, anchors, QUANTITY_RE, "quantity", (v) => textOf(v).replace(/\s+/g, " "));
  if (!qty) {
    const candidates = detections
      .map((item) => ({ item, match: inlineValue(item, QUANTITY_RE, 0) }))
      .filter((entry) => entry.match && /\bnet|\bweight|\bvolume/i.test(entry.item.text))
      .sort((a, b) => b.item.confidence - a.item.confidence);
    if (!candidates.length) return { quantity: field(null, 0), unit: field(null, 0) };
    const best = candidates[0];
    return quantityResult(best.match, best.item, 0.88);
  }
  return quantityResult(qty.value, qty.item, Math.min(0.96, 0.48 + qty.score * 0.50));
}

function quantityResult(value, item, confidence) {
  const match = textOf(value).match(QUANTITY_RE);
  const number = match?.[1] || null;
  const unit = match?.[2]?.toLowerCase() || null;
  const canonicalUnit = ({ gm: "g", gms: "g", gram: "g", grams: "g", kgs: "kg", ltr: "l", ltrs: "l", litre: "l", litres: "l", liters: "l", liter: "l", pieces: "pcs", piece: "pcs", units: "pcs", nos: "pcs" })[unit] || unit;
  return { quantity: field(number, confidence, [item]), unit: field(canonicalUnit, Math.max(0, confidence - 0.02), [item]) };
}

function extractDateField(detections, fieldName) {
  const anchors = detections.filter((item) => DATE_LABELS[fieldName]?.test(item.text));
  const regex = new RegExp(DATE_RE.source, "i");
  const result = collectInlineOrNearby(detections, anchors, regex, "date");
  if (!result) return field(null, 0);
  return field(result.value, Math.min(0.95, 0.48 + result.score * 0.45), [result.item, ...(result.anchor ? [result.anchor] : [])]);
}

function extractBatch(detections) {
  const anchors = detections.filter((item) => BATCH_LABEL_RE.test(item.text));
  const regex = /\b(?:batch|lot|b\.?\s*no\.?)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9./_-]{1,28})\b/i;
  const result = collectInlineOrNearby(detections, anchors, regex, "batch");
  if (!result) return field(null, 0);
  if (isDateLike(result.value) || /^\d+$/.test(result.value)) return field(null, 0, [], "ambiguous");
  return field(result.value, Math.min(0.94, 0.46 + result.score * 0.47), [result.item, ...(result.anchor ? [result.anchor] : [])]);
}

function extractFSSAI(detections) {
  const anchors = detections.filter((item) => FSSAI_LABEL_RE.test(item.text));
  const fssaiRegex = /\b([0-9OolI]{14})\b/;
  const result = collectInlineOrNearby(detections, anchors, fssaiRegex, "fssai", (v) => numericCleanup(v));
  if (!result) return field(null, 0);
  if (!/^\d{14}$/.test(result.value)) return field(null, 0, [result.item], "ambiguous");
  return field(result.value, Math.min(0.97, 0.58 + result.score * 0.42), [result.item, ...(result.anchor ? [result.anchor] : [])]);
}

function extractBarcode(detections) {
  const labelled = detections.filter((item) => BARCODE_LABEL_RE.test(item.text));
  const contextual = [];
  for (const item of detections) {
    const digitMatch = item.text.match(/\b[0-9OolI]{8,14}\b/g) || [];
    for (const raw of digitMatch) {
      const digits = gtinDigits(raw);
      if (!digits || !isValidEAN(digits)) continue;
      let score = item.confidence * 0.45 + (labelled.some((anchor) => anchor.imageIndex === item.imageIndex && distance(anchor.boundingBox, item.boundingBox) < 220) ? 0.30 : 0);
      if (item.boundingBox) score += Math.min(0.20, (item.boundingBox.width * item.boundingBox.height) / 20000);
      contextual.push({ item, digits, score });
    }
  }
  contextual.sort((a, b) => b.score - a.score);
  const best = contextual[0];
  return best ? field(best.digits, Math.min(0.96, 0.32 + best.score * 0.75), [best.item]) : field(null, 0);
}

function extractContact(detections) {
  const phones = [];
  const emails = [];
  for (const item of detections) {
    for (const raw of item.text.match(PHONE_RE) || []) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 12) phones.push({ item, value: raw.trim(), score: item.confidence });
    }
    for (const raw of item.text.match(EMAIL_RE) || []) emails.push({ item, value: raw.trim(), score: item.confidence });
  }
  phones.sort((a, b) => b.score - a.score);
  emails.sort((a, b) => b.score - a.score);
  return {
    phone: phones[0] ? field(phones[0].value, Math.min(0.94, 0.42 + phones[0].score * 0.52), [phones[0].item]) : field(null, 0),
    email: emails[0] ? field(emails[0].value, Math.min(0.96, 0.46 + emails[0].score * 0.50), [emails[0].item]) : field(null, 0),
  };
}

function identityNoise(text) {
  const value = textOf(text);
  if (value.length < 2 || value.length > 70) return true;
  if (/^\d+$/.test(value)) return true;
  if (isDateLike(value) || QUANTITY_RE.test(value) || MRP_LABEL_RE.test(value)) return true;
  if (EMAIL_RE.test(value) || PHONE_RE.test(value)) {
    EMAIL_RE.lastIndex = 0;
    PHONE_RE.lastIndex = 0;
    return true;
  }
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  if (PROMO_RE.test(value) || CLAIM_RE.test(value) || LEGAL_RE.test(value)) return true;
  if (/\b(?:ingredients?|nutrition|calories|directions|warning|caution|storage|keep|store|license|licence|customer|consumer|helpline|complaint)\b/i.test(value)) return true;
  if (ADDRESS_RE.test(value) && /\d/.test(value)) return true;
  if (GENERIC_IDENTITY_RE.test(value)) return true;
  if (/^[^A-Za-z]*$/.test(value)) return true;
  return false;
}

function identityFeatures(item, detections) {
  const valid = detections.filter((d) => d.boundingBox);
  const maxArea = Math.max(1, ...valid.map((d) => d.boundingBox.width * d.boundingBox.height));
  const maxHeight = Math.max(1, ...valid.map((d) => d.boundingBox.height));
  const areaRatio = item.boundingBox ? (item.boundingBox.width * item.boundingBox.height) / maxArea : 0.18;
  const heightRatio = item.boundingBox ? item.boundingBox.height / maxHeight : 0.18;
  const repeated = detections.filter((other) => other.imageIndex !== item.imageIndex && levenshteinSimilarity(item.text, other.text) >= 0.86).length;
  const words = item.text.split(/\s+/).filter(Boolean).length;
  const shortPenalty = words > 7 ? 0.12 : 0;
  const genericPenalty = GENERIC_IDENTITY_RE.test(item.text) ? 0.40 : 0;
  const orgPenalty = ORGANIZATION_RE.test(item.text) && /\b(?:ltd|limited|pvt|private|company|corporation|industr)/i.test(item.text) ? 0.10 : 0;
  const productHint = PRODUCT_HINT_RE.test(item.text) ? 0.14 : 0;
  const claimPenalty = CLAIM_RE.test(item.text) ? 0.32 : 0;
  const adminPenalty = LEGAL_RE.test(item.text) ? 0.28 : 0;
  return { areaRatio, heightRatio, repeated, words, shortPenalty, genericPenalty, orgPenalty, productHint, claimPenalty, adminPenalty };
}

function rankIdentity(detections) {
  const candidates = detections.filter((item) => !identityNoise(item.text));
  return candidates.map((item) => {
    const f = identityFeatures(item, detections);
    let score = 0;
    score += f.areaRatio * 0.32;
    score += f.heightRatio * 0.28;
    score += item.confidence * 0.18;
    score += Math.min(0.16, f.repeated * 0.08);
    score += f.productHint;
    if (f.words >= 2 && f.words <= 5) score += 0.07;
    if (f.words === 1) score += 0.02;
    score -= f.shortPenalty + f.genericPenalty + f.orgPenalty + f.claimPenalty + f.adminPenalty;
    if (/^[A-Z0-9][A-Za-z0-9&' .-]{2,50}$/.test(item.text)) score += 0.04;
    return { item, score: Math.max(0, Math.min(1, score)), features: f };
  }).sort((a, b) => b.score - a.score);
}

function pairIdentity(detections) {
  const ranked = rankIdentity(detections);
  if (!ranked.length) return { productName: field(null, 0), brandName: field(null, 0), candidates: [] };

  const product = ranked.find((candidate) => candidate.features.productHint > 0 && candidate.features.words <= 6) || ranked[0];
  const brandCandidates = ranked
    .filter((candidate) => candidate.item.id !== product.item.id)
    .filter((candidate) => candidate.features.words <= 4)
    .sort((a, b) => (b.features.areaRatio + b.features.heightRatio + b.item.confidence) - (a.features.areaRatio + a.features.heightRatio + a.item.confidence));
  const brand = brandCandidates[0] || product;

  const productConfidence = Math.min(0.93, 0.34 + product.score * 0.68);
  const brandConfidence = Math.min(0.91, 0.31 + brand.score * 0.64);
  const productStatus = productConfidence >= 0.56 ? "found" : "ambiguous";
  const brandStatus = brandConfidence >= 0.54 ? "found" : "ambiguous";

  return {
    productName: field(product.item.text, productConfidence, [product.item], productStatus, { imageIndex: product.item.imageIndex }),
    brandName: field(brand.item.text, brandConfidence, [brand.item], brandStatus, { imageIndex: brand.item.imageIndex }),
    candidates: ranked.slice(0, 12).map((candidate) => ({
      text: candidate.item.text,
      score: Number(candidate.score.toFixed(3)),
      imageIndex: candidate.item.imageIndex,
      confidence: candidate.item.confidence,
      productHint: Boolean(candidate.features.productHint),
      repeated: candidate.features.repeated,
    })),
  };
}

function extractRoleAndAddress(detections, role) {
  const anchors = detections.filter((item) => LABELS[role]?.test(item.text));
  if (!anchors.length) return { value: field(null, 0), address: field(null, 0) };
  const valueCandidates = [];
  for (const anchor of anchors) {
    const inline = textOf(anchor.text).match(/(?:manufactured|mfd|mfg|packed|pkd|marketed|imported|manufacturer|packer|marketer|importer)\s*(?:by|:)?\s*(.+)$/i);
    if (inline?.[1] && inline[1].trim().length > 1 && !LABELS[role].test(inline[1])) {
      valueCandidates.push({ anchor, item: anchor, value: inline[1].trim(), score: 0.92 });
      continue;
    }
    const nearby = detections
      .filter((item) => item.imageIndex === anchor.imageIndex && item.id !== anchor.id)
      .map((item) => ({ item, score: candidateScore(anchor, item, "role") }))
      .filter((entry) => Number.isFinite(entry.score) && entry.score > 0.20)
      .filter((entry) => !MRP_LABEL_RE.test(entry.item.text) && !FSSAI_LABEL_RE.test(entry.item.text) && !QUANTITY_RE.test(entry.item.text))
      .sort((a, b) => b.score - a.score);
    if (nearby[0]) valueCandidates.push({ anchor, item: nearby[0].item, value: nearby[0].item.text, score: nearby[0].score });
  }
  valueCandidates.sort((a, b) => b.score - a.score);
  const best = valueCandidates[0];
  if (!best) return { value: field(null, 0), address: field(null, 0) };

  const lines = [best.item];
  let current = best.item;
  for (let i = 0; i < 4; i += 1) {
    if (!current.boundingBox) break;
    const next = detections
      .filter((item) => item.imageIndex === current.imageIndex && !lines.some((line) => line.id === item.id) && item.boundingBox)
      .map((item) => ({ item, gap: verticalGap(current.boundingBox, item.boundingBox), xGap: Math.abs(item.boundingBox.left - current.boundingBox.left), score: candidateScore(best.anchor, item, "role") }))
      .filter((entry) => entry.item.boundingBox.top >= current.boundingBox.top && entry.gap <= Math.max(28, current.boundingBox.height * 1.8) && entry.xGap <= Math.max(60, current.boundingBox.width * 0.7))
      .filter((entry) => entry.score > 0.15 && !MRP_LABEL_RE.test(entry.item.text) && !FSSAI_LABEL_RE.test(entry.item.text) && !BARCODE_LABEL_RE.test(entry.item.text))
      .sort((a, b) => a.gap - b.gap || b.score - a.score);
    if (!next[0]) break;
    lines.push(next[0].item);
    current = next[0].item;
  }

  const addressLines = lines.filter((item, index) => index > 0 && (ADDRESS_RE.test(item.text) || /\d/.test(item.text) || ORGANIZATION_RE.test(item.text)));
  const combinedValue = lines.map((item) => item.text).join(" ");
  const combinedAddress = addressLines.map((item) => item.text).join(" ");
  const boxItems = addressLines.length ? addressLines : lines;
  const combinedBox = boxItems.every((item) => item.boundingBox)
    ? {
      left: Math.min(...boxItems.map((item) => item.boundingBox.left)),
      top: Math.min(...boxItems.map((item) => item.boundingBox.top)),
      width: Math.max(...boxItems.map((item) => item.boundingBox.left + item.boundingBox.width)) - Math.min(...boxItems.map((item) => item.boundingBox.left)),
      height: Math.max(...boxItems.map((item) => item.boundingBox.top + item.boundingBox.height)) - Math.min(...boxItems.map((item) => item.boundingBox.top)),
    }
    : null;

  const roleValue = field(combinedValue, Math.min(0.93, 0.42 + best.score * 0.50), lines, combinedValue === best.value ? null : "found");
  const addressConfidence = addressLines.length ? Math.min(0.91, 0.40 + addressLines.length * 0.08 + best.score * 0.30) : 0;
  const address = addressLines.length
    ? field(combinedAddress, addressConfidence, addressLines, null, { boundingBox: combinedBox })
    : field(null, 0);
  return { value: roleValue, address };
}

function countryOfOrigin(detections) {
  const anchor = detections.filter((item) => /\bcountry\s+of\s+origin\b|\bmade\s+in\b|\bproduct\s+of\b/i.test(item.text));
  const regex = /(?:country\s+of\s+origin|made\s+in|product\s+of)\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{1,40})/i;
  const result = collectInlineOrNearby(detections, anchor, regex, "country");
  return result ? field(textOf(result.value).replace(/[.,]+$/, ""), Math.min(0.92, 0.45 + result.score * 0.45), [result.item]) : field(null, 0);
}

function reconcileSimilar(fieldValue, candidates) {
  if (!fieldValue?.value) return fieldValue;
  const peers = candidates.filter((candidate) => levenshteinSimilarity(fieldValue.value, candidate.value) >= 0.86);
  if (!peers.length) return fieldValue;
  const support = Math.min(0.16, peers.length * 0.05);
  return { ...fieldValue, confidence: Math.min(0.98, fieldValue.confidence + support), status: "found", crossImageAgreement: peers.length + 1 };
}

function extractIdentityAndCrossImage(detections) {
  const identity = pairIdentity(detections);
  for (const key of ["productName", "brandName"]) {
    const current = identity[key];
    if (!current.value) continue;
    const peers = detections
      .filter((item) => item.imageIndex !== current.imageIndex && !identityNoise(item.text))
      .map((item) => ({ value: item.text, similarity: levenshteinSimilarity(current.value, item.text), item }))
      .filter((entry) => entry.similarity >= 0.86)
      .sort((a, b) => b.similarity - a.similarity)
      .map((entry) => ({ value: entry.item.text, similarity: entry.similarity }));
    identity[key] = reconcileSimilar(current, peers);
  }
  return identity;
}

export function interpretOcrFields({ detections = [], rawText = "" } = {}) {
  const prepared = prepareDetections(detections);
  const identity = extractIdentityAndCrossImage(prepared);
  const quantity = extractQuantity(prepared);
  const contact = extractContact(prepared);
  const manufacturer = extractRoleAndAddress(prepared, "manufacturer");
  const packer = extractRoleAndAddress(prepared, "packer");
  const marketer = extractRoleAndAddress(prepared, "marketer");
  const importer = extractRoleAndAddress(prepared, "importer");

  const fields = {
    productName: identity.productName,
    brandName: identity.brandName,
    mrp: extractMRP(prepared),
    netQuantity: quantity.quantity,
    unit: quantity.unit,
    batchNumber: extractBatch(prepared),
    dateOfManufacture: extractDateField(prepared, "dateOfManufacture"),
    dateOfPacking: extractDateField(prepared, "dateOfPacking"),
    bestBefore: extractDateField(prepared, "bestBefore"),
    expiryDate: extractDateField(prepared, "expiryDate"),
    manufacturer: manufacturer.value,
    manufacturerAddress: manufacturer.address,
    packer: packer.value,
    packerAddress: packer.address,
    marketer: marketer.value,
    marketerAddress: marketer.address,
    importer: importer.value,
    importerAddress: importer.address,
    consumerCarePhone: contact.phone,
    consumerCareEmail: contact.email,
    countryOfOrigin: countryOfOrigin(prepared),
    fssaiLicenseNumber: extractFSSAI(prepared),
    barcode: extractBarcode(prepared),
  };

  const detectedText = prepared.map((item) => item.text).join("\n");
  const warnings = [];
  if (prepared.some((item) => item.text.match(/[\u0080-\uFFFF]{2,}/))) warnings.push("OCR contains non-Latin or potentially corrupted characters; identity fields may need review.");
  if (prepared.some((item) => !item.boundingBox)) warnings.push("Some OCR detections have no bounding box; spatial association was skipped for those detections.");
  if (/\b(?:see|refer|check)\b[^\n]{0,120}\b(?:individual|inner\s+pack|inside|under\s+the\s+seal)\b/i.test(detectedText)) warnings.push("Package text references an inner/individual pack; batch/date/price details may be elsewhere.");

  const needsReview = Object.values(fields).some((item) => item.status === "ambiguous" || (item.status === "found" && item.confidence < 0.58));

  return {
    fields,
    candidateEvidence: {
      productName: identity.candidates,
      brandName: identity.candidates,
      mrp: prepared.filter((item) => MRP_LABEL_RE.test(item.text) || MRP_CURRENCY_RE.test(item.text)).map((item) => item.text),
      quantity: prepared.filter((item) => QUANTITY_RE.test(item.text)).map((item) => item.text),
      dates: prepared.filter((item) => DATE_RE.test(item.text)).map((item) => item.text),
      fssai: prepared.filter((item) => FSSAI_LABEL_RE.test(item.text) || /\b\d{14}\b/.test(numericCleanup(item.text))).map((item) => item.text),
      barcode: prepared.filter((item) => BARCODE_LABEL_RE.test(item.text) || /\b\d{8,14}\b/.test(numericCleanup(item.text))).map((item) => item.text),
    },
    metadata: {
      source: "LOCAL_DETERMINISTIC_RECONCILER",
      detectionCount: prepared.length,
      images: new Set(prepared.map((item) => item.imageIndex)).size,
      candidateEvidence: identity.candidates,
      imageQuality: {
        detections: prepared.length,
        withBoundingBoxes: prepared.filter((item) => item.boundingBox).length,
        averageConfidence: prepared.length ? prepared.reduce((sum, item) => sum + item.confidence, 0) / prepared.length : 0,
      },
      innerPackReference: /\b(?:see|refer|check)\b[^\n]{0,120}\b(?:individual|inner\s+pack|inside|under\s+the\s+seal)\b/i.test(detectedText),
      rawTextPreserved: true,
      noExternalModel: true,
      needsReview,
      warningCount: warnings.length,
    },
    rawText: textOf(rawText) || detectedText,
    warnings,
  };
}

export default { interpretOcrFields };
