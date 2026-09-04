/**
 * Fast semantic interpreter for package OCR.
 * Pure, deterministic, framework-free. No network/model calls.
 * It complements the existing local rules/GLiNER pipeline.
 */

const CLAIM_VERBS = /\b(?:tighten(?:s|ing)?|fight(?:s|ing)?|protect(?:s|ing)?|prevent(?:s|ing)?|remove(?:s|ing)?|reduce(?:s|ing)?|control(?:s|ling)?|treat(?:s|ing)?|help(?:s|ing|s)?|improve(?:s|ing)?|strengthen(?:s|ing)?|whiten(?:s|ing)?|freshen(?:s|ing)?|clean(?:s|ing)?|purif(?:y|ies|ying)|restore(?:s|ing)?|support(?:s|ing)?|boost(?:s|ing)?|enhance(?:s|ing)?|nourish(?:es|ing)?|repair(?:s|ing)?|relieve(?:s|ing)?|cure(?:s|ing)?|heal(?:s|ing)?|soothe(?:s|ing)?|kill(?:s|ing)?|give(?:s|ing)?)\b/i;
const CLAIM_CONTEXT = /\b(?:germs?|bacteria|cavity|cavities|gums?|teeth|breath|protection|care|natural|ayurvedic|herbal|trusted|best|new|improved|advanced|complete|total|life)\b/i;
const LEGAL_OR_INSTRUCTION = /^(?:for|visit|toll|e-?mail|made\s+in|store\s+in|for\s+sale|marketed|manufactured|mfd|mfg|packed|pkd|imported|consumer|customer|country|address|ingredients?|nutrition|net|best|use|mrp|batch|barcode|license|manager|regd|registered|division|office)\b/i;
const ADDRESS_HINTS = /\b(?:road|street|st\.?|rd\.?|district|dist\.?|state|pin|pincode|village|taluka|tehsil|industrial|sector|phase|building|floor|plot|nagar|centre|center)\b/i;
const LABEL_LINE = /\b(?:mfd\.?\s*by|mfg\.?\s*by|manufactured\s+by|manufacturer|marketed\s+by|marketer|packed\s+by|packer|imported\s+by|importer|consumer\s+care|customer\s+care|country\s+of\s+origin|made\s+in|fssai|license|barcode|batch|lot|mrp|maximum\s+retail\s+price)\b/i;
const UNIT_REGEX = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|ltrs|litre|litres|liter|liters|pcs|piece|pieces|pack|packs|nos)\b/i;
const MRP_REGEX = /(?:₹|\brs\.?|\binr\b|\bm\.?r\.?p\.?\b)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
const PHONE_REGEX = /\+?\d[\d\-\s]{7,14}\d/g;
const EMAIL_REGEX = /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const BARCODE_REGEX = /\b\d{8,18}\b/g;
const DATE_REGEX = /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s*[A-Za-z]{3,9}\s*\d{2,4}|[A-Za-z]{3,9}\s*\d{4})\b/g;

const FIELD_LABELS = {
  manufacturer: /\b(?:mfd\.?\s*by|mfg\.?\s*by|manufactured\s+by|manufacturer)\b/i,
  marketer: /\b(?:marketed\s+by|marketer)\b/i,
  packer: /\b(?:packed\s+by|packer)\b/i,
  importer: /\b(?:imported\s+by|importer)\b/i,
  countryOfOrigin: /\b(?:country\s+of\s+origin|made\s+in)\b/i,
};

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function norm(value) {
  return cleanText(value).toLowerCase();
}

function normalizeDetection(item, index) {
  const text = cleanText(item?.text);
  if (!text) return null;
  const box = item?.boundingBox;
  return {
    index,
    text,
    normalized: norm(text),
    confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : null,
    boundingBox: box && typeof box === "object"
      ? {
          left: Number(box.left ?? box.x) || 0,
          top: Number(box.top ?? box.y) || 0,
          width: Number(box.width) || 0,
          height: Number(box.height) || 0,
        }
      : null,
  };
}

function buildLines(ocrText, detections = []) {
  const detected = Array.isArray(detections) ? detections.map(normalizeDetection).filter(Boolean) : [];
  const seen = new Set(detected.map((item) => item.normalized));
  const extras = String(ocrText || "")
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean)
    .filter((text) => !seen.has(norm(text)))
    .map((text, i) => ({
      index: detected.length + i,
      text,
      normalized: norm(text),
      confidence: null,
      boundingBox: null,
    }));
  return detected.concat(extras);
}

function claimScore(text) {
  const value = cleanText(text);
  if (!value) return 0;
  let score = 0;
  if (CLAIM_VERBS.test(value)) score += 0.62;
  if (CLAIM_CONTEXT.test(value)) score += 0.2;
  if (value.split(/\s+/).length >= 2 && CLAIM_VERBS.test(value)) score += 0.2;
  return Math.min(1, score);
}

function isNoise(line) {
  const text = cleanText(line.text);
  if (!text || text.length < 2) return true;
  if (LEGAL_OR_INSTRUCTION.test(text)) return true;
  if (LABEL_LINE.test(text)) return true;
  if (ADDRESS_HINTS.test(text)) return true;
  if (UNIT_REGEX.test(text) || MRP_REGEX.test(text)) return true;
  if (/^\+?\d[\d\s()\-]{7,}$/.test(text)) return true;
  if (/^\d{6,14}$/.test(text)) return true;
  if (/^(?:save|offer|free|discount|limited\s+offer|introductory)\b/i.test(text)) return true;
  if (claimScore(text) >= 0.55) return true;
  return false;
}

function prominenceScores(lines) {
  const boxes = lines.filter((line) => line.boundingBox?.width > 0 && line.boundingBox?.height > 0);
  if (!boxes.length) return new Map(lines.map((line) => [line.index, 0.4]));
  const maxArea = Math.max(...boxes.map((line) => line.boundingBox.width * line.boundingBox.height));
  const maxHeight = Math.max(...boxes.map((line) => line.boundingBox.height));
  const maxWidth = Math.max(...boxes.map((line) => line.boundingBox.width));
  return new Map(lines.map((line) => {
    if (!line.boundingBox?.width || !line.boundingBox?.height) return [line.index, 0.35];
    const area = line.boundingBox.width * line.boundingBox.height;
    const areaScore = maxArea ? area / maxArea : 0;
    const heightScore = maxHeight ? line.boundingBox.height / maxHeight : 0;
    const widthScore = maxWidth ? line.boundingBox.width / maxWidth : 0;
    return [line.index, Math.min(1, heightScore * 0.55 + areaScore * 0.35 + widthScore * 0.1)];
  }));
}

function field(value, confidence, evidence = null, status = null) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
  return {
    value: hasValue ? value : null,
    confidence: hasValue ? Math.max(0, Math.min(1, confidence)) : 0,
    confidenceLabel: !hasValue ? "LOW" : confidence >= 0.75 ? "HIGH" : confidence >= 0.45 ? "MEDIUM" : "LOW",
    status: status || (hasValue ? "found" : "not_found"),
    evidence: evidence || null,
    source: "SEMANTIC_HEURISTIC",
  };
}

function rankIdentityCandidates(lines, prominence) {
  return lines
    .filter((line) => !isNoise(line))
    .map((line) => {
      const claim = claimScore(line.text);
      const prominenceScore = prominence.get(line.index) || 0.4;
      const words = line.text.split(/\s+/).filter(Boolean);
      let score = prominenceScore * 0.78 + (line.confidence ?? 0.55) * 0.12 - claim * 0.9;
      if (line.text === line.text.toUpperCase()) score += 0.08;
      if (words.length <= 4) score += 0.04;
      return { line, claim, prominence: prominenceScore, score };
    })
    .filter((item) => item.claim < 0.45)
    .sort((a, b) => b.score - a.score);
}

function identitySimilarity(a, b) {
  const left = cleanText(a).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const right = cleanText(b).toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!left || !right) return 0;
  const rows = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
  }
  return 1 - rows[left.length][right.length] / Math.max(left.length, right.length);
}

function repeatCount(line, lines) {
  return lines.reduce((count, item) => count + (norm(item.text) === norm(line.text) ? 1 : 0), 0);
}

function nearRepeatCount(line, lines) {
  return lines.reduce((count, item) => count + (norm(item.text) !== norm(line.text) && identitySimilarity(line.text, item.text) >= 0.82 ? 1 : 0), 0);
}

function pickProductName(candidates, brandName) {
  const distinct = candidates.filter((candidate) => !brandName || identitySimilarity(candidate.line.text, brandName.value) < 0.9);
  const top = distinct[0];
  if (!top || top.score < 0.35) return field(null, 0);
  const repeated = repeatCount(top.line, candidates.map((candidate) => candidate.line));
  const nearRepeated = nearRepeatCount(top.line, candidates.map((candidate) => candidate.line));
  const confidence = Math.min(0.94, 0.32 + top.prominence * 0.55 + repeated * 0.08 + nearRepeated * 0.05 + (top.line.confidence || 0.55) * 0.08 - top.claim * 0.15);
  return field(top.line.text, confidence, `Prominent non-promotional identity text; repeats=${repeated + nearRepeated}`);
}

function pickBrandName(candidates) {
  if (!candidates.length) return field(null, 0);
  const scored = candidates.map((candidate) => {
    const lines = candidates.map((item) => item.line);
    const repeated = repeatCount(candidate.line, lines);
    const nearRepeated = nearRepeatCount(candidate.line, lines);
    return { candidate, repeated, nearRepeated, score: candidate.score + Math.min(0.36, repeated * 0.14 + nearRepeated * 0.08) };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top) return field(null, 0);
  const cluster = scored.filter((item) => identitySimilarity(item.candidate.line.text, top.candidate.line.text) >= 0.82).sort((a, b) => (b.repeated * 2 + b.nearRepeated + b.candidate.score) - (a.repeated * 2 + a.nearRepeated + a.candidate.score));
  const representative = cluster[0] || top;
  const confidence = Math.min(0.92, 0.34 + representative.candidate.prominence * 0.44 + representative.repeated * 0.1 + representative.nearRepeated * 0.05 + (representative.candidate.line.confidence || 0.55) * 0.08);
  return field(representative.candidate.line.text, confidence, `Identity consensus; repeats=${representative.repeated + representative.nearRepeated}`);
}

function extractMRP(lines) {
  for (const line of lines) {
    if (/\bsave\b/i.test(line.text) || /\bdiscount\b/i.test(line.text)) continue;
    const match = line.text.match(MRP_REGEX);
    if (match) return field(Number(match[1].replace(/,/g, "")), 0.84, line.text);
  }
  return field(null, 0);
}

function extractQuantity(lines) {
  for (const line of lines) {
    const match = line.text.match(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|ltrs|litre|litres|liter|liters|pcs|piece|pieces|pack|packs|nos)\b/i);
    if (match) return { netQuantity: field(Number(match[1]), 0.84, line.text), unit: field(match[2], 0.84, line.text) };
  }
  return { netQuantity: field(null, 0), unit: field(null, 0) };
}

function extractLabeled(lines, key) {
  const label = FIELD_LABELS[key];
  if (!label) return field(null, 0);
  for (let i = 0; i < lines.length; i += 1) {
    if (!label.test(lines[i].text)) continue;
    const sameLine = cleanText(lines[i].text.replace(label, "").replace(/^[:\-–]+/, ""));
    if (sameLine) return field(sameLine, 0.83, lines[i].text);
    const collected = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j += 1) {
      if (LABEL_LINE.test(lines[j].text)) break;
      if (MRP_REGEX.test(lines[j].text) || UNIT_REGEX.test(lines[j].text)) break;
      if (claimScore(lines[j].text) >= 0.55) break;
      collected.push(lines[j].text);
      if (collected.length >= 1 && !ADDRESS_HINTS.test(lines[j].text)) break;
    }
    if (collected.length) return field(cleanText(collected.join(", ")), 0.72, `${lines[i].text} ${collected[0]}`);
  }
  return field(null, 0);
}

function extractCountry(lines) {
  for (const line of lines) {
    const match = line.text.match(/\bmade\s+in\s+(.+)$/i);
    if (match) return field(cleanText(match[1]), 0.8, line.text);
  }
  return field(null, 0);
}

function extractContact(lines) {
  let phone = field(null, 0);
  let email = field(null, 0);
  for (const line of lines) {
    if (!/\b(?:consumer|customer|care|helpline|toll\s*free|complaint)\b/i.test(line.text)) continue;
    const p = line.text.match(PHONE_REGEX);
    const e = line.text.match(EMAIL_REGEX);
    if (p && !phone.value) phone = field(cleanText(p[0]), 0.78, line.text);
    if (e && !email.value) email = field(e[0], 0.78, line.text);
  }
  return { phone, email };
}

function isValidGtIn(value) {
  const digits = cleanText(value).replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const check = Number(digits[digits.length - 1]);
  let sum = 0;
  let weight = 3;
  for (let index = digits.length - 2; index >= 0; index -= 1) {
    sum += Number(digits[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === check;
}

function extractLicenseAndBarcode(lines) {
  let fssai = field(null, 0);
  const barcodeCandidates = [];
  for (const line of lines) {
    const numbers = line.text.match(BARCODE_REGEX) || [];
    for (const value of numbers) {
      if (value.length === 14 && !fssai.value && /fssai|licen[cs]e/i.test(line.text)) fssai = field(value, 0.78, line.text);
      const context = `${line.text} ${value}`;
      if (isValidGtIn(value) && !/(phone|mobile|toll|consumer\s+care|licen[cs]e|batch|lot)/i.test(context)) {
        barcodeCandidates.push({ value, score: value.length === 13 ? 1 : 0.9, evidence: line.text });
      }
    }
  }
  barcodeCandidates.sort((a, b) => b.score - a.score);
  const winner = barcodeCandidates[0];
  return { fssai, barcode: winner ? field(winner.value, 0.9, winner.evidence) : field(null, 0) };
}

function extractDates(lines) {
  const result = { dateOfManufacture: field(null, 0), dateOfPacking: field(null, 0), bestBefore: field(null, 0), expiryDate: field(null, 0) };
  for (const line of lines) {
    const match = line.text.match(DATE_REGEX)?.[0];
    if (!match) continue;
    if (/\b(?:mfd|mfg|manufactur)/i.test(line.text) && !result.dateOfManufacture.value) result.dateOfManufacture = field(match, 0.72, line.text);
    else if (/\b(?:pkd|packed|packing)/i.test(line.text) && !result.dateOfPacking.value) result.dateOfPacking = field(match, 0.72, line.text);
    else if (/\bbest\s*before\b/i.test(line.text) && !result.bestBefore.value) result.bestBefore = field(match, 0.72, line.text);
    else if (/\b(?:exp|expiry|use\s*by)\b/i.test(line.text) && !result.expiryDate.value) result.expiryDate = field(match, 0.72, line.text);
  }
  return result;
}

export function interpretPackage({ ocrText = "", detections = [] } = {}) {
  const lines = buildLines(ocrText, detections);
  const prominence = prominenceScores(lines);
  const candidates = rankIdentityCandidates(lines, prominence);
  const brandName = pickBrandName(candidates);
  const productName = pickProductName(candidates, brandName);
  const { netQuantity, unit } = extractQuantity(lines);
  const contacts = extractContact(lines);
  const extra = extractLicenseAndBarcode(lines);
  const dates = extractDates(lines);
  const manufacturer = extractLabeled(lines, "manufacturer");
  const marketer = extractLabeled(lines, "marketer");
  const packer = extractLabeled(lines, "packer");
  const importer = extractLabeled(lines, "importer");
  const countryOfOrigin = extractCountry(lines);

  return {
    productName,
    brandName,
    mrp: extractMRP(lines),
    netQuantity,
    unit,
    manufacturer,
    marketer,
    packer,
    importer,
    countryOfOrigin,
    consumerCarePhone: contacts.phone,
    consumerCareEmail: contacts.email,
    fssaiLicenseNumber: extra.fssai,
    barcode: extra.barcode,
    ...dates,
    semanticMetadata: {
      source: "SEMANTIC_HEURISTIC",
      totalLinesAnalyzed: lines.length,
      identityCandidateCount: candidates.length,
      hasGeometry: lines.some((line) => line.boundingBox),
    },
  };
}
