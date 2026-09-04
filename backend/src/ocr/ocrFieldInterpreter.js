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

function allLines(detections, rawText) {
  const dets = uniqueDetections(detections);
  const seen = new Set(dets.map((d) => `${d.imageIndex}|${d.normalized}`));
  const raw = textOf(rawText);
  if (raw) {
    raw.split(/\r?\n/).map(textOf).filter(Boolean).forEach((line, index) => {
      const key = `0|${norm(line)}`;
      if (seen.has(key)) return;
      dets.push({ id: `raw-${index}`, text: line, normalized: norm(line), confidence: 0.55, boundingBox: null, imageIndex: 0, index: dets.length });
    });
  }
  return dets;
}

function sortReadingOrder(items) {
  return [...items].sort((a, b) => {
    if (a.boundingBox && b.boundingBox) {
      const dy = a.boundingBox.top - b.boundingBox.top;
      const threshold = Math.max(a.boundingBox.height, b.boundingBox.height, 8) * 0.55;
      if (Math.abs(dy) > threshold) return dy;
      return a.boundingBox.left - b.boundingBox.left;
    }
    if (a.boundingBox) return -1;
    if (b.boundingBox) return 1;
    return a.index - b.index;
  });
}

function buildSpatialLines(detections) {
  const groups = new Map();
  for (const d of uniqueDetections(detections)) {
    const keyImage = d.imageIndex;
    if (!groups.has(keyImage)) groups.set(keyImage, []);
    groups.get(keyImage).push(d);
  }
  const result = [];
  for (const [imageIndex, group] of groups) {
    const ordered = sortReadingOrder(group);
    const lines = [];
    for (const item of ordered) {
      if (!item.boundingBox) {
        lines.push({ ...item, members: [item] });
        continue;
      }
      let best = null;
      let bestScore = 0;
      for (const line of lines) {
        const last = line.members[line.members.length - 1];
        if (!last.boundingBox) continue;
        const overlap = verticalOverlap(item.boundingBox, last.boundingBox);
        const verticalGap = Math.abs(center(item.boundingBox).y - center(last.boundingBox).y);
        const maxGap = Math.max(item.boundingBox.height, last.boundingBox.height) * 0.8;
        if (overlap >= 0.35 && verticalGap <= maxGap) {
          const score = overlap + (horizontalOverlap(item.boundingBox, last.boundingBox) * 0.2);
          if (score > bestScore) { best = line; bestScore = score; }
        }
      }
      if (!best) {
        best = { imageIndex, members: [item] };
        lines.push(best);
      } else {
        best.members.push(item);
      }
    }
    for (const line of lines) {
      const members = sortReadingOrder(line.members);
      const boxes = members.map((m) => m.boundingBox).filter(Boolean);
      const bbox = boxes.length ? {
        left: Math.min(...boxes.map((b) => b.left)),
        top: Math.min(...boxes.map((b) => b.top)),
        width: Math.max(...boxes.map((b) => b.left + b.width)) - Math.min(...boxes.map((b) => b.left)),
        height: Math.max(...boxes.map((b) => b.top + b.height)) - Math.min(...boxes.map((b) => b.top)),
      } : null;
      result.push({
        id: members.map((m) => m.id).join("+"),
        imageIndex,
        text: textOf(members.map((m) => m.text).join(" ")),
        normalized: norm(members.map((m) => m.text).join(" ")),
        confidence: members.reduce((sum, m) => sum + m.confidence, 0) / members.length,
        boundingBox: bbox,
        members,
      });
    }
  }
  return result.sort((a, b) => a.imageIndex - b.imageIndex || ((a.boundingBox?.top ?? 0) - (b.boundingBox?.top ?? 0)) || ((a.boundingBox?.left ?? 0) - (b.boundingBox?.left ?? 0)));
}

function isAddressLike(text) {
  const value = textOf(text);
  const n = norm(value);
  let score = 0;
  if (ADDRESS_WORD_RE.test(value)) score += 2;
  if (/\b\d{6}\b/.test(value)) score += 3;
  if (/\b(?:p\.?o\.?|post|taluka|tehsil|district|dist\.?|state)\b/i.test(value)) score += 2;
  if (/,/.test(value)) score += 0.5;
  if (value.length > 35) score += 1;
  if (ORGANIZATION_RE.test(value)) score += 0.5;
  return n.length > 8 && score >= 2;
}

function isAdministrative(text) {
  const value = textOf(text);
  if (!value) return true;
  if (ADMIN_RE.test(value)) return true;
  if (PROMO_RE.test(value)) return true;
  if (CLAIM_RE.test(value)) return true;
  if (MRP_LABEL_RE.test(value)) return true;
  if (FSSAI_LABEL_RE.test(value)) return true;
  if (BARCODE_CONTEXT_RE.test(value)) return true;
  if (EMAIL_RE.test(value)) return true;
  if (/^\+?\d[\d\s().-]{7,}$/.test(value)) return true;
  if (/^\d{6,18}$/.test(value.replace(/[\s-]/g, ""))) return true;
  if (DATE_RE.test(value)) return true;
  if (QUANTITY_RE.test(value)) return true;
  return false;
}

function isIdentityCandidate(line) {
  const text = textOf(line.text);
  if (text.length < 2 || text.length > 70) return false;
  if (isAdministrative(text) || isAddressLike(text)) return false;
  if (GENERIC_IDENTITY_RE.test(text)) return false;
  if (/^[^A-Za-z]+$/.test(text)) return false;
  if (/\b(?:lic\.?\s*no|license|licence)\b/i.test(text)) return false;
  return true;
}

function prominence(line, all) {
  if (!line.boundingBox) return 0.38;
  const usable = all.filter((x) => x.boundingBox);
  if (!usable.length) return 0.38;
  const area = line.boundingBox.width * line.boundingBox.height;
  const height = line.boundingBox.height;
  const maxArea = Math.max(1, ...usable.map((x) => x.boundingBox.width * x.boundingBox.height));
  const maxHeight = Math.max(1, ...usable.map((x) => x.boundingBox.height));
  const maxWidth = Math.max(1, ...usable.map((x) => x.boundingBox.width));
  return Math.min(1, area / maxArea * 0.45 + height / maxHeight * 0.4 + line.boundingBox.width / maxWidth * 0.15);
}

function repetition(line, lines) {
  const exact = new Set();
  const near = new Set();
  for (const other of lines) {
    if (sameImage(line, other)) continue;
    const similarity = levenshteinSimilarity(line.text, other.text);
    if (similarity >= 0.96) exact.add(other.imageIndex);
    else if (similarity >= 0.84) near.add(other.imageIndex);
  }
  return { exact: exact.size, near: near.size };
}

function identityCandidates(lines) {
  const usable = lines.filter(isIdentityCandidate);
  return usable.map((line) => {
    const rep = repetition(line, usable);
    const prom = prominence(line, lines);
    const conf = line.confidence;
    const words = line.text.split(/\s+/).filter(Boolean);
    let score = 0.45 * prom + 0.22 * conf + Math.min(0.18, rep.exact * 0.09 + rep.near * 0.045);
    if (line.text === line.text.toUpperCase() && /[A-Z]/.test(line.text)) score += 0.08;
    if (words.length <= 5) score += 0.05;
    if (words.length >= 2) score += 0.04;
    if (/^[A-Za-z][A-Za-z0-9&'()./ -]+$/.test(line.text)) score += 0.04;
    if (CLAIM_RE.test(line.text)) score -= 0.4;
    if (isAddressLike(line.text)) score -= 0.35;
    return { line, score: Math.max(0, Math.min(1, score)), prominence: prom, repetition: rep };
  }).sort((a, b) => b.score - a.score);
}

function buildField(value, score, evidence, status = "found", extra = {}) {
  const hasValue = value != null && textOf(value) !== "";
  return {
    value: hasValue ? value : null,
    confidence: hasValue ? Math.max(0, Math.min(1, score || 0)) : 0,
    confidenceLabel: !hasValue ? "LOW" : score >= 0.75 ? "HIGH" : score >= 0.45 ? "MEDIUM" : "LOW",
    status: hasValue ? status : status === "referenced_inner_pack" ? status : "not_detected",
    evidence: evidence || null,
    source: "LOCAL_GEOMETRY_RECONCILER",
    ...extra,
  };
}

function extractRegexFromText(lines, regex, transform = (m) => m[0]) {
  const results = [];
  for (const line of lines) {
    regex.lastIndex = 0;
    const match = regex.exec(line.text);
    if (match) results.push({ value: transform(match), line, confidence: line.confidence });
  }
  return results;
}

function parseMRP(lines) {
  const candidates = [];
  for (const line of lines) {
    const labelled = MRP_LABEL_RE.test(line.text);
    const direct = MRP_VALUE_RE.exec(line.text);
    if (direct && labelled === false && /(?:save|offer|discount)/i.test(line.text)) continue;
    if (direct) candidates.push({ value: Number(direct[1].replace(/,/g, "")), line, score: 0.82 + (labelled ? 0.08 : 0) });
    if (labelled && !direct && line.boundingBox) {
      for (const valueLine of lines) {
        if (!sameImage(line, valueLine) || valueLine.id === line.id) continue;
        const valueMatch = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:[.,][0-9]{1,2})?)/i.exec(valueLine.text) || (/^\s*\d{1,6}(?:[.,]\d{1,2})?\s*$/.test(valueLine.text) ? [valueLine.text, valueLine.text.trim()] : null);
        if (!valueMatch || DATE_RE.test(valueLine.text) || QUANTITY_RE.test(valueLine.text)) continue;
        const dist = distance(line.boundingBox, valueLine.boundingBox);
        const maxDist = Math.max(60, line.boundingBox.height * 8);
        const dy = valueLine.boundingBox.top - line.boundingBox.top;
        const aligned = horizontalOverlap(line.boundingBox, valueLine.boundingBox) >= 0.2;
        if (dy >= -line.boundingBox.height && dy <= maxDist && aligned && dist <= maxDist * 1.4) {
          candidates.push({ value: Number(String(valueMatch[1]).replace(/,/g, "")), line: valueLine, score: 0.66 });
        }
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
      let score = 0.6 + line.confidence * 0.2;
      if (/\bnet\s*(?:qty|quantity|weight|volume)\b/i.test(line.text)) score += 0.12;
      candidates.push({ value, unit: match[2], line, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  if (!winner) return { netQuantity: buildField(null, 0, null), unit: buildField(null, 0, null) };
  return {
    netQuantity: buildField(winner.value, Math.min(0.95, winner.score), winner.line.text, "found", { imageIndex: winner.line.imageIndex }),
    unit: buildField(winner.unit, Math.min(0.95, winner.score), winner.line.text, "found", { imageIndex: winner.line.imageIndex }),
  };
}

function nearbyValue(labelLine, lines, matcher, stopRegex) {
  const candidates = [];
  for (const line of lines) {
    if (line.id === labelLine.id || !sameImage(line, labelLine)) continue;
    const match = matcher.exec(line.text);
    if (!match) continue;
    if (stopRegex?.test(line.text)) continue;
    if (labelLine.boundingBox && line.boundingBox) {
      const dy = line.boundingBox.top - labelLine.boundingBox.top;
      const xOverlap = horizontalOverlap(labelLine.boundingBox, line.boundingBox);
      const maxDistance = Math.max(80, labelLine.boundingBox.height * 10);
      const dist = distance(labelLine.boundingBox, line.boundingBox);
      if (dy < -labelLine.boundingBox.height * 0.75 || dy > maxDistance || dist > maxDistance * 1.5) continue;
      candidates.push({ line, match, score: 0.52 + xOverlap * 0.18 + (dy >= 0 ? 0.1 : 0) });
    } else {
      candidates.push({ line, match, score: 0.48 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function parseBatch(lines) {
  const candidates = [];
  for (const line of lines) {
    const inline = /\b(?:batch|lot|b\.?\s*no\.?)\b\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9./_-]{1,40})/i.exec(line.text);
    if (inline && !/^(?:no|number|code)$/i.test(inline[1])) candidates.push({ value: inline[1], line, score: 0.82 });
    if (/\b(?:batch|lot|b\.?\s*no\.?)\b/i.test(line.text) && !inline) {
      const next = nearbyValue(line, lines, /[A-Za-z0-9][A-Za-z0-9./_-]{1,40}/, DATE_RE);
      if (next) candidates.push({ value: textOf(next.match[0]), line: next.line, score: next.score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  return winner ? buildField(winner.value, winner.score, winner.line.text, "found", { imageIndex: winner.line.imageIndex }) : buildField(null, 0, null, "not_detected");
}

function parseDates(lines) {
  const output = {};
  for (const [key, label] of Object.entries(DATE_LABELS)) {
    const candidates = [];
    for (const line of lines) {
      if (!label.test(line.text)) continue;
      const inline = DATE_RE.exec(line.text);
      if (inline) candidates.push({ value: inline[0], line, score: 0.84 });
      else {
        const near = nearbyValue(line, lines, DATE_RE, /\b(?:batch|lot|mrp|fssai|license|barcode)\b/i);
        if (near) candidates.push({ value: near.match[0], line: near.line, score: near.score + 0.1 });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const winner = candidates[0];
    output[key] = winner ? buildField(winner.value, Math.min(0.95, winner.score), winner.line.text, "found", { imageIndex: winner.line.imageIndex }) : buildField(null, 0, null, "not_detected");
  }
  return output;
}

function parseContact(lines, rawText) {
  const emailCandidates = [];
  const phoneCandidates = [];
  const sourceLines = [...lines, ...(textOf(rawText) ? [{ text: textOf(rawText), confidence: 0.45, imageIndex: null, boundingBox: null, id: "raw-contact" }] : [])];
  for (const line of sourceLines) {
    const careContext = /\b(?:consumer|customer|care|helpline|toll\s*free|complaint|contact)\b/i.test(line.text);
    for (const match of line.text.matchAll(EMAIL_RE)) emailCandidates.push({ value: match[0], line, score: careContext ? 0.9 : 0.72 });
    for (const match of line.text.matchAll(PHONE_RE)) {
      const digits = match[0].replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 13) continue;
      if (/^(\d)\1+$/.test(digits)) continue;
      phoneCandidates.push({ value: textOf(match[0]), line, score: careContext ? 0.86 : 0.6 });
    }
  }
  const bestEmail = emailCandidates.sort((a, b) => b.score - a.score)[0];
  const bestPhone = phoneCandidates.sort((a, b) => b.score - a.score)[0];
  return {
    consumerCareEmail: bestEmail ? buildField(bestEmail.value, bestEmail.score, bestEmail.line.text, "found", bestEmail.line.imageIndex == null ? {} : { imageIndex: bestEmail.line.imageIndex }) : buildField(null, 0, null),
    consumerCarePhone: bestPhone ? buildField(bestPhone.value, bestPhone.score, bestPhone.line.text, "found", bestPhone.line.imageIndex == null ? {} : { imageIndex: bestPhone.line.imageIndex }) : buildField(null, 0, null),
  };
}

function parseFssai(lines) {
  const candidates = [];
  for (const line of lines) {
    const nearby = FSSAI_LABEL_RE.test(line.text) && /\d{14}/.test(line.text);
    const nums = line.text.match(/\b\d{14}\b/g) || [];
    for (const n of nums) {
      if (nearby) candidates.push({ value: n, line, score: 0.93 });
    }
  }
  if (!candidates.length) {
    for (const line of lines) {
      if (!FSSAI_LABEL_RE.test(line.text)) continue;
      const next = nearbyValue(line, lines, /\b\d{14}\b/, null);
      if (next) candidates.push({ value: next.match[0], line: next.line, score: next.score + 0.1 });
    }
  }
  const winner = candidates.sort((a, b) => b.score - a.score)[0];
  return winner ? buildField(winner.value, Math.min(0.98, winner.score), winner.line.text, "found", { imageIndex: winner.line.imageIndex }) : buildField(null, 0, null);
}

function gtinValid(value) {
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
    const contextual = BARCODE_CONTEXT_RE.test(line.text);
    const nums = line.text.match(/\b\d{8,14}\b/g) || [];
    for (const n of nums) {
      if (/\b(?:fssai|license|licence|phone|mobile|contact|batch|lot)\b/i.test(line.text) && !contextual) continue;
      if (!gtinValid(n)) continue;
      let score = n.length === 13 ? 0.88 : 0.82;
      if (contextual) score += 0.1;
      if (line.boundingBox) score += 0.02;
      candidates.push({ value: n, line, score });
    }
  }
  const winner = candidates.sort((a, b) => b.score - a.score)[0];
  return winner ? buildField(winner.value, Math.min(0.98, winner.score), winner.line.text, "found", { imageIndex: winner.line.imageIndex, format: `GTIN-${winner.value.length}` }) : buildField(null, 0, null, "not_detected");
}

function parseOrigin(lines) {
  for (const line of lines) {
    const match = /\b(?:made\s+in|country\s+of\s+origin|product\s+of)\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{1,40})/i.exec(line.text);
    if (match) return buildField(textOf(match[1]), 0.88, line.text, "found", { imageIndex: line.imageIndex });
  }
  return buildField(null, 0, null, "not_detected");
}

function parseRole(lines, role) {
  const label = LABELS[role];
  const companyCandidates = [];
  const addressCandidates = [];
  for (const line of lines) {
    if (!label.test(line.text)) continue;
    const sameLine = textOf(line.text.replace(label, "").replace(/^\s*[:\-–,]+/, ""));
    if (sameLine && !isAddressLike(sameLine)) companyCandidates.push({ value: sameLine, line, score: 0.88 });
    for (const candidate of lines) {
      if (!sameImage(line, candidate) || candidate.id === line.id) continue;
      if (LABELS.manufacturer.test(candidate.text) || LABELS.packer.test(candidate.text) || LABELS.marketer.test(candidate.text) || LABELS.importer.test(candidate.text)) continue;
      if (DATE_RE.test(candidate.text) || MRP_LABEL_RE.test(candidate.text) || /\bfssai\b/i.test(candidate.text) || CLAIM_RE.test(candidate.text)) continue;
      if (isAddressLike(candidate.text)) {
        if (line.boundingBox && candidate.boundingBox) {
          const dy = candidate.boundingBox.top - line.boundingBox.top;
          const dist = distance(line.boundingBox, candidate.boundingBox);
          if (dy >= -line.boundingBox.height && dy <= Math.max(140, line.boundingBox.height * 14) && dist <= Math.max(180, line.boundingBox.height * 16)) {
            addressCandidates.push({ value: candidate.text, line: candidate, score: 0.62 + Math.max(0, horizontalOverlap(line.boundingBox, candidate.boundingBox)) * 0.15 });
          }
        } else {
          addressCandidates.push({ value: candidate.text, line: candidate, score: 0.5 });
        }
      } else if (!sameLine && /[A-Za-z]{3,}/.test(candidate.text) && candidate.index > line.index && candidate.index <= line.index + 4 && !isAdministrative(candidate.text) && !companyCandidates.length) {
        companyCandidates.push({ value: candidate.text, line: candidate, score: 0.62 });
      }
    }
  }
  companyCandidates.sort((a, b) => b.score - a.score);
  addressCandidates.sort((a, b) => b.score - a.score);
  const company = companyCandidates[0];
  const address = addressCandidates[0];
  return {
    company: company ? buildField(company.value, company.score, company.line.text, "found", { imageIndex: company.line.imageIndex }) : buildField(null, 0, null),
    address: address ? buildField(address.value, address.score, address.line.text, "found", { imageIndex: address.line.imageIndex }) : buildField(null, 0, null),
  };
}

function chooseIdentity(lines) {
  const candidates = identityCandidates(lines);
  if (!candidates.length) return { product: buildField(null, 0, null), brand: buildField(null, 0, null), candidates: [] };

  const productPool = candidates.map((item) => {
    let score = item.score;
    const text = item.line.text;
    if (/\b(?:toothpaste|tooth\s*powder|biscuits?|cookies?|noodles?|snacks?|chips?|soap|shampoo|detergent|oil|ghee|milk|chocolate|coffee|tea|juice|drink|masala|spice|flour|rice|atta|salt|sugar|sauce|cream|powder)\b/i.test(text)) score += 0.1;
    if (/\b(?:brand|trademark)\b/i.test(text)) score -= 0.2;
    return { ...item, productScore: Math.min(1, score) };
  }).sort((a, b) => b.productScore - a.productScore);

  const product = productPool[0];
  const brandPool = candidates.map((item) => {
    let score = item.score;
    const similarity = product ? levenshteinSimilarity(item.line.text, product.line.text) : 0;
    if (product && similarity >= 0.9) score -= 0.45;
    if (item.line.text.split(/\s+/).length <= 3) score += 0.04;
    if (item.line.text === item.line.text.toUpperCase()) score += 0.06;
    if (ORGANIZATION_RE.test(item.line.text)) score -= 0.16;
    return { ...item, brandScore: Math.max(0, Math.min(1, score)) };
  }).sort((a, b) => b.brandScore - a.brandScore);

  const brand = brandPool[0] && brandPool[0].brandScore >= 0.42 ? brandPool[0] : null;
  const productConfidence = product ? Math.min(0.94, 0.25 + product.productScore * 0.72 + Math.min(0.1, product.repetition.exact * 0.05)) : 0;
  const brandConfidence = brand ? Math.min(0.9, 0.25 + brand.brandScore * 0.62 + Math.min(0.1, brand.repetition.exact * 0.05)) : 0;
  return {
    product: product ? buildField(product.line.text, productConfidence, product.line.text, productConfidence >= 0.68 ? "found" : "needs_review", { imageIndex: product.line.imageIndex }) : buildField(null, 0, null),
    brand: brand ? buildField(brand.line.text, brandConfidence, brand.line.text, brandConfidence >= 0.62 ? "found" : "needs_review", { imageIndex: brand.line.imageIndex }) : buildField(null, 0, null),
    candidates: candidates.slice(0, 8).map((item) => ({ text: item.line.text, score: Number(item.score.toFixed(3)), imageIndex: item.line.imageIndex })),
  };
}

function detectInnerPack(rawText, lines) {
  for (const line of lines) {
    if (INNER_PACK_RE.test(line.text)) return { detected: true, evidence: line.text, imageIndex: line.imageIndex };
  }
  const raw = textOf(rawText);
  if (raw && INNER_PACK_RE.test(raw)) return { detected: true, evidence: raw.match(INNER_PACK_RE)?.[0] || null, imageIndex: null };
  return { detected: false, evidence: null, imageIndex: null };
}

function applyInnerPack(fields, ref) {
  if (!ref.detected) return fields;
  const keys = ["mrp", "batchNumber", "dateOfManufacture", "dateOfPacking", "bestBefore", "expiryDate"];
  const next = { ...fields };
  for (const key of keys) {
    if (next[key]?.status === "not_detected") {
      next[key] = buildField(null, 0, `Packaging references additional detail on an inner/individual pack: ${ref.evidence || "reference detected"}`, "referenced_inner_pack", { imageIndex: ref.imageIndex });
    }
  }
  return next;
}

function reconcile(existing, local) {
  const result = { ...(existing || {}) };
  for (const key of FIELD_NAMES) {
    const candidate = local[key];
    if (!candidate || candidate.value == null || candidate.status === "not_detected") continue;
    const current = result[key];
    if (!current || !current.value || current.status === "not_found" || current.status === "not_detected" || current.status === "absent") {
      result[key] = candidate;
      continue;
    }
    const currentConfidence = Number(current.confidence || 0);
    const candidateConfidence = Number(candidate.confidence || 0);
    const currentValue = textOf(current.value);
    const candidateValue = textOf(candidate.value);
    const similarity = levenshteinSimilarity(currentValue, candidateValue);
    const saferReplacement = key === "productName" || key === "brandName";
    if (candidateConfidence > currentConfidence + 0.14 || (saferReplacement && current.status === "needs_review" && candidate.status === "found" && similarity < 0.75 && candidateConfidence > 0.62)) {
      result[key] = candidate;
    }
  }
  return result;
}

export function interpretOcrFields({ detections = [], rawText = "", existingFields = null } = {}) {
  const lines = allLines(detections, rawText);
  const spatialLines = buildSpatialLines(detections);
  const semanticLines = spatialLines.length ? spatialLines.concat(lines.filter((line) => !line.boundingBox && !spatialLines.some((s) => s.id === line.id))) : lines;
  const identity = chooseIdentity(semanticLines);
  const quantity = parseQuantity(semanticLines);
  const dates = parseDates(semanticLines);
  const manufacturer = parseRole(semanticLines, "manufacturer");
  const packer = parseRole(semanticLines, "packer");
  const marketer = parseRole(semanticLines, "marketer");
  const importer = parseRole(semanticLines, "importer");
  const contacts = parseContact(semanticLines, rawText);
  const ref = detectInnerPack(rawText, semanticLines);

  let fields = {
    productName: identity.product,
    brandName: identity.brand,
    mrp: parseMRP(semanticLines),
    netQuantity: quantity.netQuantity,
    unit: quantity.unit,
    batchNumber: parseBatch(semanticLines),
    ...dates,
    manufacturer: manufacturer.company,
    manufacturerAddress: manufacturer.address,
    packer: packer.company,
    packerAddress: packer.address,
    marketer: marketer.company,
    marketerAddress: marketer.address,
    importer: importer.company,
    importerAddress: importer.address,
    consumerCarePhone: contacts.consumerCarePhone,
    consumerCareEmail: contacts.consumerCareEmail,
    countryOfOrigin: parseOrigin(semanticLines),
    fssaiLicenseNumber: parseFssai(semanticLines),
    barcode: parseBarcode(semanticLines),
  };

  fields = applyInnerPack(fields, ref);
  fields = reconcile(existingFields, fields);

  return {
    fields,
    innerPackReference: ref,
    candidateEvidence: { identity: identity.candidates },
    metadata: {
      source: "LOCAL_GEOMETRY_RECONCILER",
      detectionCount: Array.isArray(detections) ? detections.length : 0,
      spatialLineCount: spatialLines.length,
      rawLineCount: lines.length,
      geometryAvailable: spatialLines.some((line) => line.boundingBox),
    },
  };
}
