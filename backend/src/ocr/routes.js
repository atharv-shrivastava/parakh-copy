import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

function fieldSource(fieldName) {
  const map = {
    productName: "PRODUCT_NAME", brandName: "BRAND", manufacturer: "MANUFACTURER", manufacturerAddress: "ADDRESS",
    packer: "PACKER", packerAddress: "ADDRESS", marketer: "MARKETER", importer: "IMPORTER", importerAddress: "ADDRESS",
    netQuantity: "NET_QUANTITY", unit: "NET_QUANTITY", mrp: "MRP", currency: "MRP",
    dateOfManufacture: "DATE_OF_MANUFACTURE", dateOfPacking: "DATE_OF_PACKING", bestBefore: "BEST_BEFORE",
    expiryDate: "EXPIRY_DATE", batchNumber: "BATCH_NUMBER", consumerCarePhone: "CONSUMER_CARE",
    consumerCareEmail: "CONSUMER_CARE", countryOfOrigin: "COUNTRY_OF_ORIGIN", fssaiLicenseNumber: "FSSAI_LICENSE",
    barcode: "BARCODE",
  };
  return map[fieldName] || fieldName.toUpperCase();
}

function makeRulesEvidence(ocr) {
  const declarations = Array.isArray(ocr?.declarationEvidence) ? ocr.declarationEvidence : [];
  const evidence = [];
  for (const [field, item] of Object.entries(ocr || {})) {
    if (!item || typeof item !== "object" || item.status !== "found" || item.value == null || field === "semantic") continue;
    const type = fieldSource(field);
    const declaration = declarations.find((entry) => entry.type === type);
    evidence.push({
      evidenceId: `ocr-${field}-${crypto.randomUUID()}`,
      field,
      rawValue: item.raw ?? item.evidence ?? item.value,
      normalizedValue: item.value,
      unit: field === "unit" ? String(item.value) : undefined,
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.45)),
      source: "OCR",
      sourceImageRef: declaration ? `image-${Number(declaration.imageIndex) + 1}` : undefined,
      boundingBox: declaration?.boundingBox || undefined,
      timestamp: new Date().toISOString(),
      reliability: declaration?.source === "LOCAL_RULES" ? "HIGH" : "MEDIUM",
    });
  }
  return evidence;
}

async function evaluateRules(req, ocr) {
  const rulesEngineUrl = process.env.RULES_ENGINE_URL || "http://localhost:8090";
  const body = {
    inspectionId: req.body?.inspectionId || crypto.randomUUID(),
    productId: req.body?.productId || crypto.randomUUID(),
    inspectionDate: req.body?.inspectionDate || new Date().toISOString().slice(0, 10),
    context: req.body?.context || "physical_package",
    productMetadata: {
      brandName: ocr?.brandName?.value || undefined,
      commodityCategory: req.body?.commodityCategory || "packaged commodity",
      consumerType: req.body?.consumerType || "general",
      isImported: Boolean(req.body?.isImported),
      countryOfOrigin: ocr?.countryOfOrigin?.value || undefined,
      packageType: req.body?.packageType || "retail",
    },
    evidence: makeRulesEvidence(ocr),
    visualFlags: req.body?.visualFlags || {},
  };

  const response = await fetch(`${rulesEngineUrl}/api/rules-engine/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(Number(process.env.RULES_ENGINE_TIMEOUT_MS || "15000")),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || `Rules Engine failed (${response.status}).`);
  return data;
}

router.post("/evaluate-structured", authenticate, async (req, res) => {
  try {
    const ocr = req.body?.ocr;
    if (!ocr || typeof ocr !== "object") return res.status(400).json({ error: "Missing structured OCR result." });
    const compliance = await evaluateRules(req, ocr);
    res.json({ compliance, complianceError: null });
  } catch (error) {
    console.error("[ocr:evaluate-structured]", error);
    res.status(502).json({ compliance: null, complianceError: { message: error.message || "Rules Engine evaluation failed." } });
  }
});

export default router;
