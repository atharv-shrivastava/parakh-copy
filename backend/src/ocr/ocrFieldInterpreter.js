/**
 * Generic deterministic OCR field interpreter.
 * No Gemini, OpenAI, network calls, ML models, or brand/product hardcoding.
 *
 * Purpose: reconcile noisy OCR detections using labels, spatial proximity,
 * geometry, repetition across images, conservative validation, and explicit
 * uncertainty states. Existing OCR/semantic layers remain untouched.
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
  manufacturer: /\b(?:mfd\.?\s*by|mfg\.?\s*by|manufactured\s+by|manufacturer)\b/i,
  packer: /\b(?:packed\s+by|packer)\b/i,
  marketer: /\b(?:marketed\s+by|marketer)\b/i,
  importer: /\b(?:imported\s+by|importer)\b/i,
};

const DATE_LABELS = {
  dateOfManufacture: /\b(?:mfd|mfg)\.?\s*(?:date|dt)\b|\bdate\s+of\s+(?:manufacture|manufacturing)\b|\bmanufactured\s+(?:on|date)\b/i,
  dateOfPacking: /\b(?:pkd|packed|packing)\.?\s*(?:date|dt|on)?\b|\bdate\s+of\s+packing\b/i,
  bestBefore: /\bbest\s*before\b|\buse\s*within\b/i,
  expiryDate: /\b(?:expiry|expires|exp)\.?\s*(?:date|dt)?\b|\buse\s*by\b/i,
};

const INNER_PACK_RE = /\b(?:see|refer|check)\b[^\n]{0,120}\b(?:under\s+the\s+seal|individual\s+pack|inner\s+pack|inside)\b|\b(?:under\s+the\s+seal|individual\s+pack(?:et)?|inner\s+pack(?:et)?)\b[^\n]{0,120}\b(?:batch|lot|mfg|manufactur|expiry|exp\.?|mrp|price|date|details)\b/i;
const PROMO_RE = /\b(?:save|discount|offer|cashback|buy\s+\d+|buy\s+one|get\s+one|free|flat|limited\s+offer|sale|prize|lucky\s+draw|scratch)\b/i;
const CLAIM_RE = /\b(?:tightens?|fights?|protects?|prevents?|removes?|reduces?|controls?|treats?|helps?|improves?|strengthens?|whitens?|freshens?|cleans?|purifies?|restores?|supports?|boosts?|enhances?|nourishes?|repairs?|relieves?|cures?|heals?|soothes?|kills?|gives?|long\s+life|healthy\s+gums?|fresh\s+breath|germ\s+protection)\b/i;
const ADMIN_RE = /^(?:for|visit|toll|e-?mail|made\s+in|store\s+in|for\s+sale|marketed|manufactured|mfd|mfg|packed|pkd|imported|consumer|customer|country|address|ingredients?|nutrition|net|best|use|mrp|batch|barcode|license|manager|regd|registered|division|office|helpline|complaint)\b/i;
const DATE_RE = /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s*[A-Za-z]{3,9}\s*\d{2,4}|[A-Za-z]{3,9}\s+\d{4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,16}\d)/g;
const QUANTITY_RE = /\b(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|ltrs|litre|litres|liter|liters|cl|oz|lb|pcs|pieces|piece|nos)\b/i;
const MRP_VALUE_RE = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)\b/i;
const MRP_LABEL_RE = /\bm\.?\s*r\.?\s*p\.?\b|\bmaximum\s+retail\s+price\b/i;
const FSSAI_LABEL_RE = /\bfssai\b|food\s+safety\s+(?:license|licence|number)/i;
const BARCODE_CONTEXT_RE = /\b(?:barcode|bar\s*code|ean|upc|gtin)\b/i;
const ADDRESS_WORD_RE = /\b(?:road|street|st\.?|rd\.?|nagar|district|dist\.?|state|pin\s*code|pincode|village|taluka|tehsil|industrial\s+(?:area|estate)|sector|phase|building|floor|plot|lane|avenue|near|opposite|opp\.?)\b/i;
const ORGANIZATION_RE = /\b(?:limited|ltd\.?|private|pvt\.?|company|industr(?:y|ies)|corporation|corp\.?|foods?|pharma|laborator(?:y|ies)|manufactur(?:er|ing))\b/i;
const GENERIC_IDENTITY_RE = /^(?:india|indian|bharat|wellness|foods?|products?|premium|quality|natural|pure|original|new|best|herbal|ayurvedic|advanced|total\s+care)$/i;

function textOf(value) {
  return String(value ?? "").replace(/[\u00a0\t]+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

function norm(value) {
  return textOf(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function numericConfidence(value) {
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
  if (!box || typeof box !== "object") return null;
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function overlapRatio(aStart, aSize, bStart, bSize) {
  const aEnd = aStart + aSize;
  const bEnd = bStart + bSize;
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart)) / Math.max(1, Math.min(aSize, bSize));
}

function verticalOverlap(a, b) {
  return overlapRatio(a.top, a.height, b.top, b.height);
}

function horizontalOverlap(a, b) {
  return overlapRatio(a.left, a.width, b.left, b.width);
}

function distance(a, b) {
  const ca = center(a);
  const cb = center(b);
  if (!ca || !cb) return Number.POSITIVE_INFINITY;
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

function sameImage(a, b) {
  return Number(a.imageIndex ?? 0) === Number(b.imageIndex ?? 0);
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

function uniqueDetections(detections) {
  const source = Array.isArray(detections) ? detections : [];
  const seen = new Set();
  return source.map((item, index) => {
    const text = textOf(item?.text);
    if (!text) return null;
    const imageIndex = Number.isInteger(item?.imageIndex) ? item.imageIndex : 0;
    const bbox = normalizeBox(item?.boundingBox);
    const key = `${imageIndex}|${norm(text)}|${bbox ? `${Math.round(bbox.left)}:${Math.round(bbox.top)}` : index}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      id: String(item?.id ?? `det-${index}`),
      text,
      normalized: norm(text),
      confidence: numericConfidence(item?.confidence),
      boundingBox: bbox,
      imageIndex,
      index,
    };
  }).filter(Boolean);
}

function buildField(value, confidence, evidence = null, status = null, extra = {}) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
  return {
    value: hasValue ? value : null,
    confidence: hasValue ? Math.max(0, Math.min(1, Number(confidence) || 0)) : 0,
    confidenceLabel: !hasValue ? "LOW" : Number(confidence) >= 0.75 ? "HIGH" : Number(confidence) >= 0.45 ? "MEDIUM" : "LOW",
    status: status || (hasValue ? "found" : "not_detected"),
    evidence: evidence || null,
    source: "LOCAL_DETERMINISTIC_RECONCILER",
    ...extra,
  };
}

function candidateLikeIdentity(text) {
  const value = textOf(text);
  if (value.length < 2 || value.length > 72) return false;
  if (/^\d+$/.test(value)) return false;
  if (EMAIL_RE.test(value) || PHONE_RE.test(value)) return false;
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  if (DATE_RE.test(value) || QUANTITY_RE.test(value) || MRP_LABEL_RE.test(value) || MRP_VALUE_RE.test(value)) return false;
  if (PROMO_RE.test(value) || CLAIM_RE.test(value) || ADMIN_RE.test(value)) return false;
  if (GENERIC_IDENTITY_RE.test(value)) return false;
  if (ADDRESS_WORD_RE.test(value) && /\d/.test(value)) return false;
  return /[A-Za-z]/.test(value);
}

function repetitionScore(detection, detections) {
  const same = detections.filter((other) => other.imageIndex !== detection.imageIndex && levenshteinSimilarity(detection.text, other.text) >= 0.88);
  return Math.min(0.18, same.length * 0.06);
}

function prominenceScore(detection, detections) {
  const valid = detections.filter((item) => item.boundingBox);
  if (!detection.boundingBox || !valid.length) return 0.35;
  const area = detection.boundingBox.width * detection.boundingBox.height;
  const maxArea = Math.max(1, ...valid.map((item) => item.boundingBox.width * item.boundingBox.height));
  const maxHeight = Math.max(1, ...valid.map((item) => item.boundingBox.height));
  const areaScore = area / maxArea;
  const heightScore = detection.boundingBox.height / maxHeight;
  return Math.min(1, areaScore * 0.55 + heightScore * 0.45);
}

function rankIdentityCandidates(detections) {
  return detections
    .filter((item) => candidateLikeIdentity(item.text))
    .map((item) => {
      const prominence = prominenceScore(item, detections);
      const confidence = item.confidence;
      const repetition = repetitionScore(item, detections);
      const words = item.text.split(/\s+/).filter(Boolean).length;
      let score = prominence * 0.56 + confidence * 0.20 + repetition;
      if (item.text === item.text.toUpperCase()) score += 0.07;
      if (words <= 5) score += 0.05;
      if (words >= 8) score -= 0.10;
      if (CLAIM_RE.test(item.text)) score -= 0.35;
      if (ORGANIZATION_RE.test(item.text)) score -= 0.10;
      if (GENERIC_IDENTITY_RE.test(item.text)) score -= 0.25;
      return { detection: item, score: Math.max(0, Math.min(1, score)), prominence, repetition };
    })
    .sort((a, b) => b.score - a.score);
}

function pickIdentityPair(detections) {
  const candidates = rankIdentityCandidates(detections);
  if (!candidates.length) {
    return { productName: buildField(null, 0), brandName: buildField(null, 0), candidates: [] };
  }

  const brand = candidates.find((candidate) => {
    const words = candidate.detection.text.split(/\s+/).filter(Boolean).length;
    return words <= 4 && !/\b(?:manager|division|office|registered|license|address)\b/i.test(candidate.detection.text);
  }) || candidates[0];

  const product = candidates.find((candidate) => candidate.detection.id !== brand.detection.id && levenshteinSimilarity(candidate.detection.text, brand.detection.text) < 0.86) || brand;

  const productConfidence = Math.min(0.94, 0.32 + product.score * 0.65 + (product.repetition || 0));
  const brandConfidence = Math.min(0.92, 0.30 + brand.score * 0.60 + (brand.repetition || 0));

  return {
    productName: buildField(product.detection.text, productConfidence, `Prominence=${product.prominence.toFixed(2)}; repetition support=${product.repetition.toFixed(2)}`, productConfidence >= 0.50 ? "found" : "needs_review", { imageIndex: product.detection.imageIndex }),
    brandName: buildField(brand.detection.text, brandConfidence, `Identity candidate score=${brand.score.toFixed(2)}; repetition support=${brand.repetition.toFixed(2)}`, brandConfidence >= 0.50 ? "found" : "needs_review", { imageIndex: brand.detection.imageIndex }),
    candidates: candidates.slice(0, 8).map((item) => ({ text: item.detection.text, score: Number(item.score.toFixed(3)), imageIndex: item.detection.imageIndex })),
  };
}

function findNearbyValue(lines, labelLine, predicate) {
  if (!labelLine.boundingBox) return null;
  const candidates = lines
    .filter((line) => line.id !== labelLine.id && sameImage(line, labelLine) && line.boundingBox)
    .filter((line) => predicate(line.text))
    .map((line) => {
      const dy = line.boundingBox.top - labelLine.boundingBox.top;
      const vertical = dy >= -Math.max(labelLine.boundingBox.height, 10) && dy <= Math.max(labelLine.boundingBox.height * 8, 160);
      const horizontal = horizontalOverlap(labelLine.boundingBox, line.boundingBox) >= 0.12;
      return { line, distance: distance(labelLine.boundingBox, line.boundingBox), dy, vertical, horizontal };
    })
    .filter((item) => item.vertical && item.horizontal)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.line || null;
}

function parseMRP(lines) {
  const candidates = [];
  for (const line of lines) {
    const labelled = MRP_LABEL_RE.test(line.text);
    const direct = MRP_VALUE_RE.exec(line.text);
    if (direct && labelled === false && /(?:save|offer|discount)/i.test(line.text)) continue;
    if (direct) candidates.push({ value: Number(direct[1].replace(/,/g, "")), line, score: 0.82 + (labelled ? 0.08 : 0) });
    if (labelled && !direct && line.boundingBox) {
      const valueLine = findNearbyValue(lines, line, (text) => /(?:₹|rs\.?|inr)\s*\d|^\s*\d{1,6}(?:[.,]\d{1,2})?\s*$/.test(text));
      if (valueLine && !DATE_RE.test(valueLine.text) && !QUANTITY_RE.test(valueLine.text)) {
        const match = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)/i.exec(valueLine.text) || [, valueLine.text.trim()];
        const dist = distance(line.boundingBox, valueLine.boundingBox);
        const maxDist = Math.max(60, line.boundingBox.height * 8);
        if (Number.isFinite(dist) && dist <= maxDist * 1.5) candidates.push({ value: Number(String(match[1]).replace(/,/g, "")), line: valueLine, score: 0.66 });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  if (!winner) return buildField(null, 0, null, "not_detected");
  return buildField(winner.value, winner.score, winner.line.text, "found", { imageIndex: winner.line.imageIndex });
}

function parseQuantity(lines) {
  const candidates = [];
  for (const line of lines) {
    const matches = [...line.text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|ltrs|litre|litres|liter|liters|cl|oz|lb|pcs|pieces|piece|nos)\b/gi)];
    for (const match of matches) {
      const value = Number(match[1].replace(/,/g, ""));
      candidates.push({ value, unit: match[2], line, labelled: /\bnet\s*(?:qty|quantity|weight|volume)\b/i.test(line.text) });
    }
  }
  candidates.sort((a, b) => Number(b.labelled) - Number(a.labelled));
  const winner = candidates[0];
  return winner
    ? { netQuantity: buildField(winner.value, winner.labelled ? 0.88 : 0.76, winner.line.text, "found", { imageIndex: winner.line.imageIndex }), unit: buildField(winner.unit, winner.labelled ? 0.88 : 0.76, winner.line.text, "found", { imageIndex: winner.line.imageIndex }) }
    : { netQuantity: buildField(null, 0), unit: buildField(null, 0) };
}

function parseBatch(lines) {
  const labelRe = /\b(?:batch|lot|b\.?\s*no\.?)\b/i;
  for (const line of lines) {
    if (!labelRe.test(line.text)) continue;
    const inline = line.text.match(/\b(?:batch|lot|b\.?\s*no\.?)\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9./_-]{1,40})/i);
    if (inline) return buildField(inline[1], 0.82, line.text, "found", { imageIndex: line.imageIndex });
    const valueLine = findNearbyValue(lines, line, (text) => /^[A-Za-z0-9][A-Za-z0-9./_-]{1,40}$/.test(text.trim()));
    if (valueLine) return buildField(valueLine.text, 0.66, `${line.text} ${valueLine.text}`, "found", { imageIndex: valueLine.imageIndex });
  }
  return buildField(null, 0);
}

function parseDates(lines) {
  const result = {};
  for (const [fieldName, pattern] of Object.entries(DATE_LABELS)) {
    result[fieldName] = buildField(null, 0);
    for (const line of lines) {
      if (!pattern.test(line.text)) continue;
      const direct = line.text.match(DATE_RE);
      if (direct) {
        result[fieldName] = buildField(direct[0], 0.82, line.text, "found", { imageIndex: line.imageIndex });
        break;
      }
      const valueLine = findNearbyValue(lines, line, (text) => DATE_RE.test(text));
      if (valueLine) {
        result[fieldName] = buildField(valueLine.text.match(DATE_RE)?.[0] || valueLine.text, 0.68, `${line.text} ${valueLine.text}`, "found", { imageIndex: valueLine.imageIndex });
        break;
      }
    }
  }
  return result;
}

function parseContacts(lines, rawText) {
  let email = null;
  let emailLine = null;
  let phone = null;
  let phoneLine = null;
  for (const line of lines) {
    EMAIL_RE.lastIndex = 0;
    PHONE_RE.lastIndex = 0;
    const e = line.text.match(EMAIL_RE)?.[0];
    const p = line.text.match(PHONE_RE)?.[0];
    if (!email && e) { email = e; emailLine = line; }
    if (!phone && p && /\b(?:consumer|customer|care|helpline|complaint|toll\s*free)\b/i.test(line.text)) { phone = p; phoneLine = line; }
  }
  if (!email) { EMAIL_RE.lastIndex = 0; email = String(rawText || "").match(EMAIL_RE)?.[0] || null; }
  if (!phone) {
    for (const line of lines) {
      PHONE_RE.lastIndex = 0;
      const p = line.text.match(PHONE_RE)?.[0];
      if (p && !/\b(?:fssai|license|lic\.?|batch|lot)\b/i.test(line.text)) { phone = p; phoneLine = line; break; }
    }
  }
  return {
    consumerCareEmail: buildField(email, email ? 0.84 : 0, emailLine?.text || (email ? "Recovered from raw OCR text" : null), email ? "found" : "not_detected", emailLine ? { imageIndex: emailLine.imageIndex } : {}),
    consumerCarePhone: buildField(phone, phone ? 0.76 : 0, phoneLine?.text || null, phone ? "found" : "not_detected", phoneLine ? { imageIndex: phoneLine.imageIndex } : {}),
  };
}

function parseFssai(lines) {
  for (const line of lines) {
    if (!FSSAI_LABEL_RE.test(line.text)) continue;
    const nearby = line.text.match(/\b\d{14}\b/)?.[0];
    if (nearby) return buildField(nearby, 0.90, line.text, "found", { imageIndex: line.imageIndex });
    const valueLine = findNearbyValue(lines, line, (text) => /^\d{14}$/.test(text.trim()));
    if (valueLine) return buildField(valueLine.text.trim(), 0.82, `${line.text} ${valueLine.text}`, "found", { imageIndex: valueLine.imageIndex });
  }
  return buildField(null, 0);
}

function gtinChecksum(value) {
  const digits = String(value || "").replace(/\D/g, "");
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
    const rawNumbers = line.text.match(/\b\d{8,18}\b/g) || [];
    for (const raw of rawNumbers) {
      if (!gtinChecksum(raw)) continue;
      if (FSSAI_LABEL_RE.test(line.text) || /\b(?:license|lic\.?|batch|lot|phone|mobile|toll\s*free)\b/i.test(line.text)) continue;
      const contextBoost = BARCODE_CONTEXT_RE.test(line.text) ? 0.10 : 0;
      const lengthBoost = raw.length === 13 ? 0.04 : 0;
      candidates.push({ raw, line, score: 0.86 + contextBoost + lengthBoost });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  return winner ? buildField(winner.raw, winner.score, `Checksum-valid GTIN candidate from: ${winner.line.text}`, "found", { imageIndex: winner.line.imageIndex }) : buildField(null, 0);
}

function extractLabeledEntity(lines, key) {
  const label = LABELS[key];
  const labelLines = lines.filter((line) => label.test(line.text));
  for (const line of labelLines) {
    const sameLine = textOf(line.text.replace(label, "").replace(/^\s*[:\-–,]+\s*/, ""));
    if (sameLine && !LABELS[key].test(sameLine)) {
      const value = sameLine.replace(/^[:\-–,]+/, "").trim();
      if (value) return buildField(value, 0.84, line.text, "found", { imageIndex: line.imageIndex });
    }
    const nearby = [];
    for (const candidate of lines) {
      if (candidate.id === line.id || !sameImage(candidate, line)) continue;
      if (candidate.boundingBox && line.boundingBox) {
        const dy = candidate.boundingBox.top - line.boundingBox.top;
        if (dy < -line.boundingBox.height || dy > Math.max(5 * line.boundingBox.height, 220)) continue;
      }
      if (LABELS[key].test(candidate.text) || MRP_LABEL_RE.test(candidate.text) || QUANTITY_RE.test(candidate.text) || DATE_RE.test(candidate.text)) continue;
      if (PROMO_RE.test(candidate.text) || CLAIM_RE.test(candidate.text)) continue;
      nearby.push(candidate);
    }
    nearby.sort((a, b) => (a.boundingBox ? distance(line.boundingBox, a.boundingBox) : 999999) - (b.boundingBox ? distance(line.boundingBox, b.boundingBox) : 999999));
    const winner = nearby[0];
    if (winner) return buildField(winner.text, 0.70, `${line.text} ${winner.text}`, "found", { imageIndex: winner.imageIndex });
  }
  return buildField(null, 0);
}

function extractCountry(lines) {
  for (const line of lines) {
    const match = line.text.match(/\b(?:made\s+in|country\s+of\s+origin)\s*[:\-]?\s*(.+)$/i);
    if (match) return buildField(match[1].trim(), 0.86, line.text, "found", { imageIndex: line.imageIndex });
  }
  return buildField(null, 0);
}

function imageQuality(detections) {
  const byImage = new Map();
  for (const d of detections) {
    if (!byImage.has(d.imageIndex)) byImage.set(d.imageIndex, []);
    byImage.get(d.imageIndex).push(d);
  }
  const output = {};
  for (const [index, group] of byImage) {
    const averageConfidence = group.length ? group.reduce((sum, d) => sum + d.confidence, 0) / group.length : 0;
    const totalCharacters = group.reduce((sum, d) => sum + d.text.length, 0);
    output[index] = {
      status: totalCharacters < 5 ? "unreadable_low_quality" : averageConfidence < 0.35 ? "needs_review" : "readable",
      detectionCount: group.length,
      averageConfidence,
      totalCharacters,
      hasGeometry: group.some((d) => d.boundingBox),
    };
  }
  return output;
}

function applyInnerPackStatus(fields, reference) {
  if (!reference) return fields;
  const eligible = ["mrp", "batchNumber", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate"];
  for (const key of eligible) {
    if (fields[key]?.status === "not_detected") {
      fields[key] = buildField(null, 0, reference, "referenced_inner_pack");
    }
  }
  return fields;
}

export function interpretOcrFields({ detections = [], rawText = "" } = {}) {
  const normalized = uniqueDetections(detections);
  const identity = pickIdentityPair(normalized);
  const quantity = parseQuantity(normalized);
  const dates = parseDates(normalized);
  const contacts = parseContacts(normalized, rawText);
  const innerPackReference = INNER_PACK_RE.test(textOf(rawText)) || normalized.some((line) => INNER_PACK_RE.test(line.text));
  const fields = {
    productName: identity.productName,
    brandName: identity.brandName,
    mrp: parseMRP(normalized),
    netQuantity: quantity.netQuantity,
    unit: quantity.unit,
    batchNumber: parseBatch(normalized),
    ...dates,
    manufacturer: extractLabeledEntity(normalized, "manufacturer"),
    manufacturerAddress: buildField(null, 0),
    packer: extractLabeledEntity(normalized, "packer"),
    packerAddress: buildField(null, 0),
    marketer: extractLabeledEntity(normalized, "marketer"),
    marketerAddress: buildField(null, 0),
    importer: extractLabeledEntity(normalized, "importer"),
    importerAddress: buildField(null, 0),
    consumerCarePhone: contacts.consumerCarePhone,
    consumerCareEmail: contacts.consumerCareEmail,
    countryOfOrigin: extractCountry(normalized),
    fssaiLicenseNumber: parseFssai(normalized),
    barcode: parseBarcode(normalized),
  };

  applyInnerPackStatus(fields, innerPackReference ? "OCR detected a reference to an inner/individual pack or under-seal details." : null);

  return {
    fields,
    metadata: {
      source: "LOCAL_DETERMINISTIC_RECONCILER",
      detectionCount: normalized.length,
      candidateEvidence: identity.candidates,
      imageQuality: imageQuality(normalized),
      innerPackReference,
      rawTextPreserved: true,
      noExternalModel: true,
    },
    rawText: textOf(rawText),
  };
}

export function rankProductCandidates(detections = []) {
  return rankIdentityCandidates(uniqueDetections(detections)).map((candidate) => ({
    text: candidate.detection.text,
    score: Number(candidate.score.toFixed(4)),
    prominence: Number(candidate.prominence.toFixed(4)),
    repetition: Number(candidate.repetition.toFixed(4)),
    imageIndex: candidate.detection.imageIndex,
  }));
}

export { gtinChecksum, normalizeBox, distance, levenshteinSimilarity, FIELD_NAMES };