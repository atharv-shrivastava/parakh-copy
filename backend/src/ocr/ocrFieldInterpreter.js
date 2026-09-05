/**
 * Deterministic PaddleOCR field reconciler.
 * No Gemini, GLiNER, network calls, external models, or brand hardcoding.
 *
 * Design goals:
 * - Treat OCR text and geometry as evidence, not truth.
 * - Use declaration anchors for structured fields.
 * - Score product and brand as a related pair instead of choosing the
 *   visually largest text independently.
 * - Preserve uncertainty and raw evidence rather than inventing values.
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

const MRP_LABEL_RE = /\b(?:m\.?\s*r\.?\s*p\.?|maximum\s+retail\s+price|retail\s+price)\b/i;
const MRP_CURRENCY_RE = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)/i;
const MRP_BARE_RE = /\b([0-9]{1,5}(?:[.,][0-9]{1,2})?)\b/;
// Used only to keep numeric price-like lines out of batch/lot inference.
// Keep it intentionally broader than the MRP parser because the value may be
// OCR'd on a separate line without the currency symbol or the "MRP" label.
const MRP_VALUE_RE = /(?:₹|rs\.?|inr)\s*[0-9][0-9,]*(?:[.,][0-9]{1,2})?|\b[0-9]{1,5}(?:[.,][0-9]{1,2})?\b/i;
const QUANTITY_RE = /\b([0-9]+(?:[.,][0-9]+)?)\s*(mg|mcg|g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|ltrs|litre|litres|liter|liters|cl|oz|lb|pcs|pieces|piece|units?|nos)\b/i;
const BATCH_LABEL_RE = /\b(?:batch(?:\s*(?:no|number|#|code))?|lot(?:\s*(?:no|number|#|code))?|b\.?\s*no\.?)\b/i;
const FSSAI_LABEL_RE = /\bfssai\b|food\s+safety\s+(?:license|licence|number|no)/i;
const BARCODE_LABEL_RE = /\b(?:barcode|bar\s*code|ean|upc|gtin)\b/i;
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{9}\b|(?:0[1-9]\d{2,4}[\s-]?)\d{6,8}\b/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const DATE_RE = /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s*[A-Za-z]{3,9}\s*\d{2,4}|[A-Za-z]{3,9}\s+\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}[\/\-.]\d{4}|\d{1,2}\s*[A-Za-z]{3,9})\b/i;
const ADDRESS_RE = /\b(?:road|rd\.?|street|st\.?|nagar|district|dist\.?|state|pin\s*code|pincode|village|taluka|tehsil|industrial\s+(?:area|estate)|sector|phase|building|floor|plot|lane|avenue|near|opposite|opp\.?|india)\b/i;
const ORGANIZATION_RE = /\b(?:limited|ltd\.?|private|pvt\.?|company|corporation|corp\.?|industr(?:y|ies)|foods?|pharma|laborator(?:y|ies)|ayurved|manufactur(?:er|ing))\b/i;
const PROMO_RE = /\b(?:save|offer|discount|cashback|buy\s+\d+|buy\s+one|get\s+one|free|flat|limited\s+offer|sale|prize|lucky\s+draw|scratch)\b/i;
const CLAIM_RE = /\b(?:tightens?|fights?|protects?|prevents?|removes?|reduces?|controls?|treats?|helps?|improves?|strengthens?|whitens?|freshens?|cleans?|purifies?|restores?|supports?|boosts?|enhances?|nourishes?|repairs?|relieves?|cures?|heals?|soothes?|kills?|gives?|long\s+life|healthy\s+gums?|fresh\s+breath|germ\s+protection)\b/i;
const LEGAL_RE = /^(?:for|visit|toll|e-?mail|made\s+in|store\s+in|for\s+sale|marketed|manufactured|mfd|mfg|packed|pkd|imported|consumer|customer|country|address|ingredients?|nutrition|net|best|use|mrp|batch|barcode|license|licence|manager|regd|registered|division|office|helpline|complaint)\b/i;
const GENERIC_IDENTITY_RE = /^(?:india|indian|bharat|wellness|foods?|products?|premium|quality|natural|pure|original|new|best|herbal|ayurvedic|advanced|total\s+care|toothpaste|tooth\s+paste|oral\s+care)$/i;
const PRODUCT_HINT_RE = /\b(?:toothpaste|tooth\s*powder|dentifrice|soap|shampoo|conditioner|detergent|biscuits?|cookies?|namkeen|chips?|snacks?|noodles?|atta|flour|rice|dal|pulses?|spices?|masala|tea|coffee|juice|drink|beverage|oil|ghee|butter|milk|curd|yogurt|chocolate|candy|toffee|salt|sugar|sauce|ketchup|paste|powder|cream|wafer|wafers?|dental|gum|gums|shaving|deodorant|lotion)\b/i;

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

function overlap(aStart, aSize, bStart, bSize) {
  return Math.max(0, Math.min(aStart + aSize, bStart + bSize) - Math.max(aStart, bStart));
}

function verticalOverlap(a, b) {
  if (!a || !b) return 0;
  return overlap(a.top, a.height, b.top, b.height) / Math.max(1, Math.min(a.height, b.height));
}

function horizontalOverlap(a, b) {
  if (!a || !b) return 0;
  return overlap(a.left, a.width, b.left, b.width) / Math.max(1, Math.min(a.width, b.width));
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

function prepareDetections(detections) {
  const seen = new Set();
  return (Array.isArray(detections) ? detections : [])
    .map((item, index) => {
      const text = textOf(item?.text);
      if (!text) return null;
      const boundingBox = normalizeBox(item?.boundingBox);
      const imageIndex = Number.isInteger(item?.imageIndex) ? item.imageIndex : 0;
      return {
        id: String(item?.id ?? `det-${index}`),
        text,
        normalized: norm(text),
        confidence: confidenceOf(item?.confidence),
        boundingBox,
        imageIndex,
        index,
      };
    })
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

function field(value, confidence = 0, evidence = [], status = null, extra = {}) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
  const c = Math.max(0, Math.min(1, Number(confidence) || 0));
  const resolvedStatus = status || (hasValue ? (c >= 0.5 ? "found" : "ambiguous") : "not_detected");
  return {
    value: hasValue ? value : null,
    raw: evidence[0]?.text || null,
    confidence: hasValue ? c : 0,
    status: resolvedStatus,
    evidence: evidence.map((item) => ({
      id: item.id,
      text: item.text,
      confidence: item.confidence,
      imageIndex: item.imageIndex,
      boundingBox: item.boundingBox,
    })),
    source: "LOCAL_DETERMINISTIC_RECONCILER",
    ...extra,
  };
}

function geometryScore(anchor, candidate) {
  if (!anchor?.boundingBox || !candidate?.boundingBox) return 0.2;
  const a = anchor.boundingBox;
  const b = candidate.boundingBox;
  const dist = distance(a, b);
  const maxDim = Math.max(1, a.width, a.height, b.width, b.height);
  const distanceScore = Math.max(0, 1 - dist / (maxDim * 5));
  const overlapScore = Math.max(horizontalOverlap(a, b), verticalOverlap(a, b));
  const sameRowScore = verticalOverlap(a, b);
  const belowScore = b.top >= a.top ? Math.max(0, 1 - verticalGap(a, b) / 180) : 0;
  const rightScore = b.left >= a.left ? Math.max(0, 1 - horizontalGap(a, b) / 220) : 0;
  return Math.min(1, distanceScore * 0.35 + overlapScore * 0.25 + sameRowScore * 0.20 + Math.max(belowScore, rightScore) * 0.20);
}

function nearestValue(lines, anchor, predicate, maxDistance = 260) {
  if (!anchor) return null;
  const candidates = lines
    .filter((candidate) => candidate.id !== anchor.id && candidate.imageIndex === anchor.imageIndex)
    .filter((candidate) => predicate(candidate.text, candidate))
    .map((candidate) => ({ candidate, score: candidate.confidence * 0.35 + geometryScore(anchor, candidate) * 0.65 }))
    .filter((item) => !anchor.boundingBox || !item.candidate.boundingBox || distance(anchor.boundingBox, item.candidate.boundingBox) <= maxDistance)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.candidate || null;
}

function parseMRP(lines) {
  const anchors = lines.filter((line) => MRP_LABEL_RE.test(line.text));
  for (const anchor of anchors) {
    const inlineCurrency = anchor.text.match(MRP_CURRENCY_RE);
    if (inlineCurrency) return field(inlineCurrency[1].replace(/,/g, ""), 0.96, [anchor], "found", { imageIndex: anchor.imageIndex });
    const inlineNumber = anchor.text.match(MRP_BARE_RE);
    if (inlineNumber && !/\b(?:20\d{2}|19\d{2})\b/.test(inlineNumber[1])) {
      return field(inlineNumber[1].replace(/,/g, ""), 0.76, [anchor], "found", { imageIndex: anchor.imageIndex });
    }
    const nearby = nearestValue(lines, anchor, (text) => MRP_CURRENCY_RE.test(text) || MRP_BARE_RE.test(text), 260);
    if (nearby) {
      const match = nearby.text.match(MRP_CURRENCY_RE) || nearby.text.match(MRP_BARE_RE);
      if (match && !/\b(?:20\d{2}|19\d{2})\b/.test(match[1])) {
        return field(match[1].replace(/,/g, ""), 0.84 * nearby.confidence, [anchor, nearby], "found", { imageIndex: nearby.imageIndex });
      }
    }
  }
  return field(null, 0);
}

function parseQuantity(lines) {
  for (const line of lines) {
    const match = line.text.match(QUANTITY_RE);
    if (!match) continue;
    const amount = match[1].replace(/,/g, "");
    const unit = match[2];
    return {
      netQuantity: field(amount, 0.9 * line.confidence, [line], "found", { imageIndex: line.imageIndex }),
      unit: field(unit, 0.9 * line.confidence, [line], "found", { imageIndex: line.imageIndex }),
    };
  }
  return { netQuantity: field(null, 0), unit: field(null, 0) };
}

function parseDates(lines) {
  const out = {};
  for (const [key, labelRe] of Object.entries(DATE_LABELS)) {
    for (const line of lines) {
      if (!labelRe.test(line.text)) continue;
      const direct = line.text.match(DATE_RE);
      if (direct) {
        out[key] = field(direct[0], 0.9 * line.confidence, [line], "found", { imageIndex: line.imageIndex });
        break;
      }
      const nearby = nearestValue(lines, line, (text) => DATE_RE.test(text), 180);
      if (nearby) {
        out[key] = field(nearby.text.match(DATE_RE)?.[0] || nearby.text, 0.75 * nearby.confidence, [line, nearby], "found", { imageIndex: nearby.imageIndex });
        break;
      }
    }
  }
  return out;
}

function parseBatch(lines) {
  for (const line of lines) {
    if (!BATCH_LABEL_RE.test(line.text)) continue;
    const cleaned = line.text.replace(/^.*?\b(?:batch|lot|b\.?\s*no\.?)\b\s*(?:no\.?|number|#|code)?\s*[:\-]?\s*/i, "").trim();
    if (cleaned && cleaned !== line.text && !LEGAL_RE.test(cleaned)) {
      return field(cleaned, 0.82 * line.confidence, [line], "found", { imageIndex: line.imageIndex });
    }
    const nearby = nearestValue(lines, line, (text) => /^[A-Za-z0-9][A-Za-z0-9./_-]{2,32}$/.test(text.trim()) && !DATE_RE.test(text) && !QUANTITY_RE.test(text) && !MRP_VALUE_RE.test(text), 160);
    if (nearby) return field(nearby.text, 0.72 * nearby.confidence, [line, nearby], "found", { imageIndex: nearby.imageIndex });
  }
  return field(null, 0);
}

function parseFssai(lines) {
  for (const line of lines) {
    if (!FSSAI_LABEL_RE.test(line.text)) continue;
    const direct = numericCleanup(line.text).match(/\b\d{14}\b/);
    if (direct) return field(direct[0], 0.94 * line.confidence, [line], "found", { imageIndex: line.imageIndex });
    const nearby = nearestValue(lines, line, (text) => /^\d{14}$/.test(numericCleanup(text).trim()), 160);
    if (nearby) return field(numericCleanup(nearby.text).trim(), 0.84 * nearby.confidence, [line, nearby], "found", { imageIndex: nearby.imageIndex });
  }
  return field(null, 0);
}

function gtinChecksum(value) {
  const digits = numericCleanup(value).replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 2; i >= 0; i -= 1) {
    sum += Number(digits[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (sum + Number(digits.at(-1))) % 10 === 0;
}
