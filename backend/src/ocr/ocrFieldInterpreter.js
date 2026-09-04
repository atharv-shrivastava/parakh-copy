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
    const nearby = nearestValue(lines, anchor, (text) => Boolean(text.match(MRP_CURRENCY_RE)) || /^\s*(?:₹|rs\.?|inr)?\s*\d{1,5}(?:[.,]\d{1,2})?\s*$/i.test(text), 180);
    if (nearby) {
      const match = nearby.text.match(MRP_CURRENCY_RE) || nearby.text.match(MRP_BARE_RE);
      if (match) return field(match[1] || match[0], nearby.confidence * 0.8, [anchor, nearby], nearby.confidence >= 0.55 ? "found" : "ambiguous", { imageIndex: nearby.imageIndex });
    }
  }
  for (const line of lines) {
    const inline = line.text.match(MRP_CURRENCY_RE);
    if (inline) return field(inline[1].replace(/,/g, ""), line.confidence * 0.9, [line], "found", { imageIndex: line.imageIndex });
  }
  return field(null, 0);
}

function parseQuantity(lines) {
  const preferred = [...lines].sort((a, b) => {
    const aLabel = /\bnet\s*(?:qty|quantity|weight|volume|vol|wt)\b/i.test(a.text) ? 1 : 0;
    const bLabel = /\bnet\s*(?:qty|quantity|weight|volume|vol|wt)\b/i.test(b.text) ? 1 : 0;
    return bLabel - aLabel || b.confidence - a.confidence;
  });
  for (const line of preferred) {
    const match = line.text.match(QUANTITY_RE);
    if (match) {
      const boost = /\bnet\s*(?:qty|quantity|weight|volume|vol|wt)\b/i.test(line.text) ? 0.92 : 0.78;
      return {
        netQuantity: field(match[1].replace(/,/g, ""), boost * line.confidence, [line], "found", { imageIndex: line.imageIndex }),
        unit: field(match[2], boost * line.confidence, [line], "found", { imageIndex: line.imageIndex }),
      };
    }
  }
  return { netQuantity: field(null, 0), unit: field(null, 0) };
}

function parseDates(lines) {
  const out = {};
  for (const [key, label] of Object.entries(DATE_LABELS)) {
    out[key] = field(null, 0);
    for (const line of lines) {
      if (!label.test(line.text)) continue;
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
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

function parseBarcode(lines) {
  const candidates = [];
  for (const line of lines) {
    const numbers = numericCleanup(line.text).match(/\b\d{8,18}\b/g) || [];
    for (const raw of numbers) {
      if (FSSAI_LABEL_RE.test(line.text) || /\b(?:license|lic\.?|batch|lot|phone|mobile|consumer\s+care|helpline)\b/i.test(line.text)) continue;
      const verified = gtinChecksum(raw);
      const contextual = BARCODE_LABEL_RE.test(line.text);
      const score = (verified ? 0.88 : contextual ? 0.68 : 0.45) + (raw.length === 13 ? 0.05 : 0);
      candidates.push({ raw, line, verified, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  if (!winner) return field(null, 0);
  return field(winner.raw, winner.score, [winner.line], winner.verified ? "found" : "ambiguous", { imageIndex: winner.line.imageIndex, validation: winner.verified ? "checksum_valid" : "unverified" });
}

function entityValueAfterLabel(lines, key) {
  const label = LABELS[key];
  const anchors = lines.filter((line) => label.test(line.text));
  for (const anchor of anchors) {
    const sameLine = textOf(anchor.text.replace(label, "").replace(/^\s*[:\-–,]+\s*/, ""));
    if (sameLine && !label.test(sameLine) && !LEGAL_RE.test(sameLine)) {
      return { value: sameLine, evidence: [anchor], imageIndex: anchor.imageIndex, anchor };
    }
    const nearby = nearestValue(lines, anchor, (text) => {
      if (!text || label.test(text) || MRP_LABEL_RE.test(text) || DATE_RE.test(text) || QUANTITY_RE.test(text)) return false;
      if (FSSAI_LABEL_RE.test(text) || BARCODE_LABEL_RE.test(text) || PROMO_RE.test(text)) return false;
      return /[A-Za-z]/.test(text);
    }, 220);
    if (nearby) return { value: nearby.text, evidence: [anchor, nearby], imageIndex: nearby.imageIndex, anchor };
  }
  return null;
}

function collectAddress(lines, anchor) {
  if (!anchor) return null;
  const ordered = lines
    .filter((line) => line.imageIndex === anchor.imageIndex && line.id !== anchor.id && line.boundingBox && anchor.boundingBox)
    .map((line) => ({ line, dy: line.boundingBox.top - (anchor.boundingBox.top + anchor.boundingBox.height), dx: Math.abs(line.boundingBox.left - anchor.boundingBox.left) }))
    .filter(({ line, dy, dx }) => dy >= -4 && dy <= 260 && dx <= Math.max(80, anchor.boundingBox.width * 0.8))
    .filter(({ line }) => !MRP_LABEL_RE.test(line.text) && !QUANTITY_RE.test(line.text) && !DATE_RE.test(line.text) && !BATCH_LABEL_RE.test(line.text) && !FSSAI_LABEL_RE.test(line.text))
    .filter(({ line }) => ADDRESS_RE.test(line.text) || /\d/.test(line.text) || ORGANIZATION_RE.test(line.text))
    .sort((a, b) => a.dy - b.dy)
    .slice(0, 5)
    .map(({ line }) => line);
  if (!ordered.length) return null;
  const evidence = [anchor, ...ordered];
  const value = ordered.map((line) => line.text).join(" ");
  return { value, evidence };
}

function parseEntities(lines) {
  const fields = {};
  for (const key of Object.keys(LABELS)) {
    const entity = entityValueAfterLabel(lines, key);
    fields[key] = entity
      ? field(entity.value, Math.min(0.94, 0.68 + entity.evidence[entity.evidence.length - 1].confidence * 0.25), entity.evidence, "found", { imageIndex: entity.imageIndex })
      : field(null, 0);
    const address = entity?.anchor ? collectAddress(lines, entity.anchor) : null;
    fields[`${key}Address`] = address
      ? field(address.value, 0.78, address.evidence, "found", { imageIndex: entity.imageIndex })
      : field(null, 0);
  }
  return fields;
}

function parseContacts(lines, rawText) {
  let email = null;
  let emailEvidence = [];
  let phone = null;
  let phoneEvidence = [];
  for (const line of lines) {
    EMAIL_RE.lastIndex = 0;
    PHONE_RE.lastIndex = 0;
    const e = line.text.match(EMAIL_RE)?.[0];
    const p = line.text.match(PHONE_RE)?.[0];
    if (e && !email) { email = e; emailEvidence = [line]; }
    if (p && !phone && /\b(?:consumer|customer|care|helpline|complaint|toll\s*free)\b/i.test(line.text)) { phone = p; phoneEvidence = [line]; }
  }
  if (!email) {
    EMAIL_RE.lastIndex = 0;
    email = String(rawText || "").match(EMAIL_RE)?.[0] || null;
  }
  if (!phone) {
    for (const line of lines) {
      PHONE_RE.lastIndex = 0;
      const p = line.text.match(PHONE_RE)?.[0];
      if (p && !FSSAI_LABEL_RE.test(line.text) && !BATCH_LABEL_RE.test(line.text)) { phone = p; phoneEvidence = [line]; break; }
    }
  }
  return {
    consumerCareEmail: field(email, email ? 0.86 : 0, emailEvidence, email ? "found" : "not_detected", emailEvidence[0] ? { imageIndex: emailEvidence[0].imageIndex } : {}),
    consumerCarePhone: field(phone, phone ? 0.78 : 0, phoneEvidence, phone ? "found" : "not_detected", phoneEvidence[0] ? { imageIndex: phoneEvidence[0].imageIndex } : {}),
  };
}

function parseCountry(lines) {
  for (const line of lines) {
    const match = line.text.match(/\b(?:made\s+in|country\s+of\s+origin)\s*[:\-]?\s*(.+)$/i);
    if (match) return field(match[1].trim(), 0.86 * line.confidence, [line], "found", { imageIndex: line.imageIndex });
  }
  return field(null, 0);
}

function candidateIdentityEligible(text) {
  const value = textOf(text);
  if (value.length < 2 || value.length > 64) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (/^\d+$/.test(value) || DATE_RE.test(value) || QUANTITY_RE.test(value) || MRP_LABEL_RE.test(value)) return false;
  if (FSSAI_LABEL_RE.test(value) || BARCODE_LABEL_RE.test(value) || PROMO_RE.test(value) || LEGAL_RE.test(value)) return false;
  if (CLAIM_RE.test(value)) return false;
  if (ADDRESS_RE.test(value) && /\d/.test(value)) return false;
  if (/[@%]/.test(value)) return false;
  return true;
}

function prominence(detection, group) {
  if (!detection.boundingBox) return 0.35;
  const valid = group.filter((item) => item.boundingBox);
  if (!valid.length) return 0.35;
  const area = detection.boundingBox.width * detection.boundingBox.height;
  const maxArea = Math.max(1, ...valid.map((item) => item.boundingBox.width * item.boundingBox.height));
  const maxHeight = Math.max(1, ...valid.map((item) => item.boundingBox.height));
  return Math.min(1, (area / maxArea) * 0.55 + (detection.boundingBox.height / maxHeight) * 0.45);
}

function topPosition(detection, group) {
  if (!detection.boundingBox) return 0.45;
  const valid = group.filter((item) => item.boundingBox);
  if (!valid.length) return 0.45;
  const minTop = Math.min(...valid.map((item) => item.boundingBox.top));
  const maxTop = Math.max(...valid.map((item) => item.boundingBox.top));
  if (maxTop <= minTop) return 0.5;
  return 1 - ((detection.boundingBox.top - minTop) / (maxTop - minTop));
}

function repetition(detection, all) {
  let best = 0;
  for (const other of all) {
    if (other.id === detection.id || other.imageIndex === detection.imageIndex) continue;
    best = Math.max(best, levenshteinSimilarity(detection.text, other.text));
  }
  return Math.min(0.18, best * 0.18);
}

function identityCandidateScores(lines) {
  const perImage = new Map();
  for (const line of lines) {
    if (!perImage.has(line.imageIndex)) perImage.set(line.imageIndex, []);
    perImage.get(line.imageIndex).push(line);
  }
  return lines
    .filter((line) => candidateIdentityEligible(line.text))
    .map((line) => {
      const group = perImage.get(line.imageIndex) || lines;
      const productHint = PRODUCT_HINT_RE.test(line.text) ? 0.30 : 0;
      const words = line.text.split(/\s+/).filter(Boolean).length;
      const p = prominence(line, group);
      const top = topPosition(line, group);
      const rep = repetition(line, lines);
      let productScore = p * 0.35 + line.confidence * 0.20 + productHint + rep;
      if (words >= 2 && words <= 6) productScore += 0.10;
      if (words === 1) productScore -= 0.08;
      if (ORGANIZATION_RE.test(line.text)) productScore -= 0.10;
      if (GENERIC_IDENTITY_RE.test(line.text)) productScore -= 0.20;
      if (CLAIM_RE.test(line.text)) productScore -= 0.35;

      let brandScore = p * 0.28 + line.confidence * 0.23 + top * 0.18 + rep;
      if (words <= 3) brandScore += 0.13;
      if (PRODUCT_HINT_RE.test(line.text)) brandScore -= 0.16;
      if (GENERIC_IDENTITY_RE.test(line.text)) brandScore -= 0.25;
      if (CLAIM_RE.test(line.text)) brandScore -= 0.30;
      if (line.text === line.text.toUpperCase()) brandScore += 0.08;
      if (ORGANIZATION_RE.test(line.text)) brandScore += 0.03;

      return { line, productScore: Math.max(0, productScore), brandScore: Math.max(0, brandScore), prominence: p, top, repetition: rep };
    });
}

function pickIdentityPair(lines) {
  const candidates = identityCandidateScores(lines);
  if (!candidates.length) return { productName: field(null, 0), brandName: field(null, 0), candidates: [] };

  const productPool = candidates.filter((item) => PRODUCT_HINT_RE.test(item.line.text));
  const brandPool = candidates.filter((item) => item.line.text.split(/\s+/).length <= 3);
  let bestPair = null;

  for (const product of (productPool.length ? productPool : candidates)) {
    for (const brand of (brandPool.length ? brandPool : candidates)) {
      if (product.line.id === brand.line.id) continue;
      if (product.line.imageIndex !== brand.line.imageIndex) continue;
      let pairScore = product.productScore + brand.brandScore;
      if (product.line.boundingBox && brand.line.boundingBox) {
        const productIsBelow = product.line.boundingBox.top >= brand.line.boundingBox.top;
        const gap = verticalGap(brand.line.boundingBox, product.line.boundingBox);
        const aligned = horizontalOverlap(brand.line.boundingBox, product.line.boundingBox);
        if (productIsBelow) pairScore += 0.24;
        if (gap <= 180) pairScore += 0.12;
        if (aligned > 0.25) pairScore += 0.10;
        pairScore -= Math.min(0.25, gap / 900);
      }
      if (PRODUCT_HINT_RE.test(product.line.text)) pairScore += 0.18;
      if (PRODUCT_HINT_RE.test(brand.line.text)) pairScore -= 0.12;
      if (!bestPair || pairScore > bestPair.score) bestPair = { product, brand, score: pairScore };
    }
  }

  if (!bestPair) {
    const bestProduct = [...candidates].sort((a, b) => b.productScore - a.productScore)[0];
    const bestBrand = [...candidates].filter((item) => item.line.id !== bestProduct.line.id).sort((a, b) => b.brandScore - a.brandScore)[0] || bestProduct;
    bestPair = { product: bestProduct, brand: bestBrand, score: bestProduct.productScore + bestBrand.brandScore };
  }

  const productConfidence = Math.min(0.92, 0.26 + bestPair.product.productScore * 0.62 + (PRODUCT_HINT_RE.test(bestPair.product.line.text) ? 0.10 : 0));
  const brandConfidence = Math.min(0.90, 0.24 + bestPair.brand.brandScore * 0.62);

  const productStatus = productConfidence >= 0.62 ? "found" : "ambiguous";
  const brandStatus = brandConfidence >= 0.58 ? "found" : "ambiguous";

  return {
    productName: field(bestPair.product.line.text, productConfidence, [bestPair.product.line], productStatus, { imageIndex: bestPair.product.line.imageIndex }),
    brandName: field(bestPair.brand.line.text, brandConfidence, [bestPair.brand.line], brandStatus, { imageIndex: bestPair.brand.line.imageIndex }),
    candidates: candidates
      .sort((a, b) => Math.max(b.productScore, b.brandScore) - Math.max(a.productScore, a.brandScore))
      .slice(0, 12)
      .map((item) => ({
        text: item.line.text,
        imageIndex: item.line.imageIndex,
        productScore: Number(item.productScore.toFixed(3)),
        brandScore: Number(item.brandScore.toFixed(3)),
        prominence: Number(item.prominence.toFixed(3)),
        repetition: Number(item.repetition.toFixed(3)),
      })),
  };
}

function hasInnerPackReference(lines, rawText) {
  const pattern = /\b(?:see|refer|check)\b[^\n]{0,140}\b(?:inner\s+pack|individual\s+pack|inside|under\s+the\s+seal)\b|\b(?:inner\s+pack|individual\s+pack|under\s+the\s+seal)\b[^\n]{0,140}\b(?:batch|lot|mfd|mfg|expiry|mrp|price|date|details)\b/i;
  return pattern.test(textOf(rawText)) || lines.some((line) => pattern.test(line.text));
}

function imageQuality(lines) {
  const groups = new Map();
  for (const line of lines) {
    if (!groups.has(line.imageIndex)) groups.set(line.imageIndex, []);
    groups.get(line.imageIndex).push(line);
  }
  const result = {};
  for (const [imageIndex, group] of groups) {
    const avg = group.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, group.length);
    result[imageIndex] = {
      detectionCount: group.length,
      averageConfidence: avg,
      hasGeometry: group.some((item) => item.boundingBox),
      status: avg < 0.40 || group.length < 3 ? "needs_review" : "readable",
    };
  }
  return result;
}

export function interpretOcrFields({ detections = [], rawText = "" } = {}) {
  const lines = prepareDetections(detections);
  const identity = pickIdentityPair(lines);
  const quantity = parseQuantity(lines);
  const contacts = parseContacts(lines, rawText);
  const entities = parseEntities(lines);
  const innerPackReference = hasInnerPackReference(lines, rawText);
  const dates = parseDates(lines);

  const fields = {
    productName: identity.productName,
    brandName: identity.brandName,
    mrp: parseMRP(lines),
    netQuantity: quantity.netQuantity,
    unit: quantity.unit,
    batchNumber: parseBatch(lines),
    ...dates,
    ...entities,
    consumerCarePhone: contacts.consumerCarePhone,
    consumerCareEmail: contacts.consumerCareEmail,
    countryOfOrigin: parseCountry(lines),
    fssaiLicenseNumber: parseFssai(lines),
    barcode: parseBarcode(lines),
  };

  if (innerPackReference) {
    for (const key of ["mrp", "batchNumber", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate"]) {
      if (fields[key]?.status === "not_detected") {
        fields[key] = field(null, 0, [{ id: "inner-pack-reference", text: "OCR detected inner/individual pack reference.", confidence: 1, imageIndex: 0, boundingBox: null }], "referenced_inner_pack");
      }
    }
  }

  return {
    fields,
    metadata: {
      source: "LOCAL_DETERMINISTIC_RECONCILER",
      detectionCount: lines.length,
      candidateEvidence: identity.candidates,
      imageQuality: imageQuality(lines),
      innerPackReference,
      rawTextPreserved: true,
      noExternalModel: true,
    },
    candidateEvidence: { identity: identity.candidates },
    rawText: textOf(rawText),
  };
}

export function rankProductCandidates(detections = []) {
  return identityCandidateScores(prepareDetections(detections))
    .sort((a, b) => b.productScore - a.productScore)
    .map((item) => ({
      text: item.line.text,
      score: Number(item.productScore.toFixed(4)),
      brandScore: Number(item.brandScore.toFixed(4)),
      imageIndex: item.line.imageIndex,
    }));
}

export { gtinChecksum, normalizeBox, distance, levenshteinSimilarity, FIELD_NAMES };
