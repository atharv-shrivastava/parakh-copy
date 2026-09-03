import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

function toNumber(value) {
  const n = Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function verifyProduct({ brandName, productName, netQuantity, unit, mrp }) {
  const missing = [];
  if (!brandName?.trim()) missing.push("manufacturer/brand information");
  if (!productName?.trim()) missing.push("product name");
  if (!netQuantity?.trim()) missing.push("net quantity");
  if (!unit?.trim()) missing.push("quantity unit");
  if (mrp === undefined || mrp === null || mrp === "" || Number.isNaN(Number(mrp))) missing.push("MRP");
  return missing.length ? { status: "VIOLATION", reason: `Missing declaration(s) requiring inspection: ${missing.join(", ")}.` } : { status: "OKAY", reason: "Automated OCR and Rules Engine assessment completed; final legal verification remains with the inspector." };
}

function visibility(req) { return req.user.role === "ADMIN" ? {} : { ownerId: req.user.id }; }

function calculateReviewedCompliance({ compliance, ocr, acceptedFindingIds }) {
  const findings = Array.isArray(compliance?.findings) ? compliance.findings : [];
  const engineViolations = findings.filter((finding) => finding?.status === "VIOLATION");
  const hasReviewSelection = Array.isArray(acceptedFindingIds);
  const acceptedSet = hasReviewSelection ? new Set(acceptedFindingIds.map(String)) : null;
  const acceptedViolations = acceptedSet ? engineViolations.filter((finding) => acceptedSet.has(String(finding.findingId))) : engineViolations;
  const rejectedViolations = hasReviewSelection ? engineViolations.filter((finding) => !acceptedSet.has(String(finding.findingId))) : [];
  const needsReview = Boolean(ocr?.needsReview) || Number(compliance?.summary?.unableToVerify || 0) > 0;
  const status = acceptedViolations.length > 0 ? "VIOLATION" : needsReview ? "NEEDS_REVIEW" : "OKAY";
  const reason = acceptedViolations.length > 0
    ? `Inspector accepted ${acceptedViolations.length} Rules Engine violation(s): ${acceptedViolations.map((x) => x.message || x.violationReason || x.ruleCode).join(" | ")}`
    : needsReview
      ? "Inspector review remains required because one or more OCR/rule checks could not be verified."
      : hasReviewSelection && rejectedViolations.length > 0
        ? "Rules Engine findings were reviewed; detected violations were not accepted by the inspector."
        : "Automated OCR and Rules Engine assessment completed; final legal verification remains with the inspector.";
  return { status, reason, engineViolations, acceptedViolations, rejectedViolations };
}

const historySelect = { id: true, productName: true, brandName: true, netQuantity: true, unit: true, mrp: true, barcode: true, complianceStatus: true, violationReason: true, createdAt: true, owner: { select: { id: true, name: true, email: true } }, category: { select: { id: true, name: true, parent: { select: { id: true, name: true, parent: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } } } } } }, inspections: { select: { inspectedAt: true, shop: { select: { id: true, name: true, address: true, city: true, state: true } }, worker: { select: { id: true, name: true } } }, orderBy: { inspectedAt: "desc" }, take: 1 } };

router.get("/history", async (req, res) => { try { const { query = "", status = "ALL" } = req.query; const search = String(query).trim(); const where = { ...visibility(req), ...(status !== "ALL" ? { complianceStatus: status } : {}), ...(search ? { OR: [{ productName: { contains: search, mode: "insensitive" } }, { brandName: { contains: search, mode: "insensitive" } }, { barcode: { contains: search, mode: "insensitive" } }, { category: { name: { contains: search, mode: "insensitive" } } }, { inspections: { some: { shop: { name: { contains: search, mode: "insensitive" } } } } }] } : {}) }; const data = await prisma.product.findMany({ where, select: historySelect, orderBy: { createdAt: "desc" }, take: 500 }); res.json(data); } catch (e) { console.error(e); res.status(500).json({ error: "Failed to fetch inspection history" }); } });

router.get("/", async (req, res) => { try { const { categoryId, status = "ALL", brandName, productName, unit, minQuantity, maxQuantity, shopName, minMrp, maxMrp } = req.query; const where = { ...visibility(req), ...(categoryId ? { categoryId } : {}), ...(status !== "ALL" ? { complianceStatus: status } : {}), ...(brandName ? { brandName: { contains: brandName, mode: "insensitive" } } : {}), ...(productName ? { productName: { contains: productName, mode: "insensitive" } } : {}), ...(unit ? { unit: { equals: unit, mode: "insensitive" } } : {}), ...(minMrp || maxMrp ? { mrp: { ...(minMrp ? { gte: Number(minMrp) } : {}), ...(maxMrp ? { lte: Number(maxMrp) } : {}) } } : {}), ...(shopName ? { inspections: { some: { shop: { name: { contains: shopName, mode: "insensitive" } } } } } : {}) }; const data = await prisma.product.findMany({ where, select: { id: true, productName: true, brandName: true, netQuantity: true, unit: true, mrp: true, complianceStatus: true, createdAt: true, owner: { select: { name: true } }, category: { select: { id: true, name: true } }, inspections: { select: { inspectedAt: true, shop: { select: { id: true, name: true } } }, orderBy: { inspectedAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 500 }); const minQ = minQuantity ? Number(minQuantity) : null; const maxQ = maxQuantity ? Number(maxQuantity) : null; res.json(data.filter((p) => { const q = toNumber(p.netQuantity); return (minQ === null || (q !== null && q >= minQ)) && (maxQ === null || (q !== null && q <= maxQ)); })); } catch (e) { console.error(e); res.status(500).json({ error: "Failed to fetch products" }); } });

router.get("/analytics/summary", async (req, res) => {
  try {
    const visibilityWhere = visibility(req);
    const [products, shops, inspections, statusGroups, categoryGroups, brandGroups] = await Promise.all([
      prisma.product.count({ where: visibilityWhere }),
      prisma.shop.count({ where: req.user.role === "ADMIN" ? {} : { ownerId: req.user.id } }),
      prisma.inspection.count({ where: req.user.role === "ADMIN" ? {} : { workerId: req.user.id } }),
      prisma.product.groupBy({ by: ["complianceStatus"], where: visibilityWhere, _count: { _all: true } }),
      prisma.product.groupBy({ by: ["categoryId"], where: visibilityWhere, _count: { _all: true }, orderBy: { _count: { categoryId: "desc" } }, take: 8 }),
      prisma.product.groupBy({ by: ["brandName"], where: { ...visibilityWhere, brandName: { not: null } }, _count: { _all: true }, orderBy: { _count: { brandName: "desc" } }, take: 8 })
    ]);
    const categoryIds = categoryGroups.map((x) => x.categoryId);
    const categoryRows = categoryIds.length ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }) : [];
    const categoryNames = new Map(categoryRows.map((x) => [x.id, x.name]));
    const violationRows = await prisma.product.findMany({
      where: { ...visibilityWhere, complianceStatus: "VIOLATION" },
      select: { ocrData: true, createdAt: true, brandName: true, categoryId: true, inspections: { select: { shopId: true, inspectedAt: true, shop: { select: { name: true, city: true, state: true } } } } },
      take: 1000
    });
    const ruleCounts = {}, locationCounts = {}, trend = {}, shopViolations = {};
    let repeatProducts = 0;
    for (const product of violationRows) {
      const inspectionsForProduct = product.inspections || [];
      if (inspectionsForProduct.length > 1) repeatProducts += 1;
      for (const inspection of inspectionsForProduct) {
        const loc = [inspection.shop?.city, inspection.shop?.state].filter(Boolean).join(", ") || "Unknown";
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        const month = new Date(inspection.inspectedAt).toISOString().slice(0, 7);
        trend[month] = (trend[month] || 0) + 1;
        if (inspection.shop?.name) shopViolations[inspection.shop.name] = (shopViolations[inspection.shop.name] || 0) + 1;
      }
      try {
        const stored = product.ocrData ? JSON.parse(product.ocrData) : null;
        for (const finding of stored?.compliance?.findings || []) if (String(finding?.status).toUpperCase() === "VIOLATION") {
          const rule = finding.ruleNumber || finding.ruleCode || "Unknown";
          ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
        }
      } catch {}
    }
    res.json({
      scope: req.user.role === "ADMIN" ? "PLATFORM" : "OWN",
      counts: { products, shops, inspections, compliant: statusGroups.find((x) => x.complianceStatus === "OKAY")?._count._all || 0, violations: statusGroups.find((x) => x.complianceStatus === "VIOLATION")?._count._all || 0, review: (statusGroups.find((x) => x.complianceStatus === "NEEDS_REVIEW")?._count._all || 0) + (statusGroups.find((x) => x.complianceStatus === "UNABLE_TO_VERIFY")?._count._all || 0) },
      topCategories: categoryGroups.map((x) => ({ categoryId: x.categoryId, name: categoryNames.get(x.categoryId) || "Unknown", products: x._count._all })),
      topBrands: brandGroups.map((x) => ({ brand: x.brandName, products: x._count._all })),
      topRules: Object.entries(ruleCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([rule,count])=>({rule,count})),
      topLocations: Object.entries(locationCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([location,inspections])=>({location,inspections})),
      violationTrend: Object.entries(trend).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([month,violations])=>({month,violations})),
      topShops: Object.entries(shopViolations).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([shop,violations])=>({shop,violations})),
      repeatProducts
    });
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to load analytics" }); }
});

router.get("/:id", async (req, res) => { try { const product = await prisma.product.findFirst({ where: { id: req.params.id, ...visibility(req) }, include: { owner: { select: { id: true, name: true, email: true } }, category: { include: { parent: { include: { parent: { include: { parent: true } } } } } }, inspections: { include: { shop: true, worker: { select: { name: true } } }, orderBy: { inspectedAt: "desc" } } } }); if (!product) return res.status(404).json({ error: "Product not found" }); res.json(product); } catch (e) { console.error(e); res.status(500).json({ error: "Failed to fetch product" }); } });

router.post("/", async (req, res) => {
  try {
    const { categoryId, brandName, productName, description, netQuantity, unit, mrp, barcode, imageUrl, imageUrls, ocrData, complianceStatus, violationReason, acceptedFindingIds, shopName, shopAddress, shopCity, shopState, inspectionDate, notes } = req.body;
    if (!categoryId || !productName?.trim() || !shopName?.trim()) return res.status(400).json({ error: "Category, product name and shop name are required" });
    const category = await prisma.category.findFirst({ where: { id: categoryId, OR: [{ isSystem: true }, { ownerId: req.user.id }] }, include: { children: true } });
    if (!category) return res.status(404).json({ error: "Category not found" });
    if (!category.isFinalProductType) return res.status(400).json({ error: "Only final categories can contain registered products" });
    const parsedMrp = mrp === "" || mrp === undefined || mrp === null ? null : Number(mrp);
    if (parsedMrp !== null && (!Number.isFinite(parsedMrp) || parsedMrp < 0)) return res.status(400).json({ error: "MRP must be a valid non-negative number" });
    let parsedImages = [];
    try { if (Array.isArray(imageUrls)) parsedImages = imageUrls.filter((x) => typeof x === "string" && x); else if (imageUrls) parsedImages = JSON.parse(imageUrls); if (!Array.isArray(parsedImages)) throw new Error("imageUrls must be an array"); } catch { return res.status(400).json({ error: "Invalid imageUrls payload" }); }

    let parsedOcrData = ocrData;
    if (typeof ocrData === "string") { try { parsedOcrData = JSON.parse(ocrData); } catch {} }
    const review = calculateReviewedCompliance({ compliance: parsedOcrData?.compliance, ocr: parsedOcrData?.ocr, acceptedFindingIds });
    const verification = verifyProduct({ brandName, productName, netQuantity, unit, mrp: parsedMrp });
    const hasEngineReviewData = Boolean(parsedOcrData?.compliance);
    const finalStatus = hasEngineReviewData ? review.status : (new Set(["OKAY", "VIOLATION", "NEEDS_REVIEW"]).has(complianceStatus) ? complianceStatus : verification.status);
    const reason = hasEngineReviewData ? review.reason : (typeof violationReason === "string" && violationReason.trim() ? violationReason.trim() : verification.reason);
    const enrichedOcrData = parsedOcrData && typeof parsedOcrData === "object" ? { ...parsedOcrData, complianceReview: { engineViolationCount: review.engineViolations.length, acceptedFindingIds: review.acceptedViolations.map((x) => x.findingId), rejectedFindingIds: review.rejectedViolations.map((x) => x.findingId), reviewedAt: new Date().toISOString() } } : parsedOcrData;
    const inspectedAt = inspectionDate ? new Date(inspectionDate) : new Date();
    if (Number.isNaN(inspectedAt.getTime())) return res.status(400).json({ error: "Invalid inspection date" });

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { categoryId, ownerId: req.user.id, brandName: brandName?.trim() || null, productName: productName.trim(), description: description?.trim() || null, ocrData: enrichedOcrData ? JSON.stringify(enrichedOcrData) : null, netQuantity: netQuantity?.trim() || null, unit: unit?.trim() || null, mrp: parsedMrp, barcode: barcode?.trim() || null, imageUrl: imageUrl?.trim() || parsedImages[0] || null, imageUrls: parsedImages, complianceStatus: finalStatus, violationReason: reason } });
      const shop = await tx.shop.create({ data: { name: shopName.trim(), address: shopAddress?.trim() || null, city: shopCity?.trim() || null, state: shopState?.trim() || null, ownerId: req.user.id } });
      const inspection = await tx.inspection.create({ data: { status: finalStatus, notes: notes?.trim() || reason, inspectedAt, workerId: req.user.id, shopId: shop.id, productId: product.id } });
      return { product, shop, inspection };
    });
    res.status(201).json({ ...result, id: result.product.id });
  } catch (e) { console.error(e); res.status(500).json({ error: e?.message || "Failed to register product" }); }
});

router.delete("/:id", async (req, res) => { try { const product = await prisma.product.findFirst({ where: { id: req.params.id, ...visibility(req) } }); if (!product) return res.status(404).json({ error: "Product not found" }); await prisma.$transaction(async (tx) => { await tx.inspection.deleteMany({ where: { productId: product.id } }); await tx.product.delete({ where: { id: product.id } }); }); res.json({ message: "Product deleted successfully" }); } catch (e) { console.error(e); res.status(500).json({ error: "Failed to delete product" }); } });

export default router;
