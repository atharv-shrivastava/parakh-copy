import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate, requireAdmin);

function normalizeDefinition(body) {
  if (!body || typeof body.definition !== "object" || Array.isArray(body.definition)) throw new Error("A complete rule definition object is required.");
  const definition = body.definition;
  const ruleId = String(body.ruleId ?? definition.ruleId ?? "").trim();
  const ruleCode = String(body.ruleCode ?? definition.ruleCode ?? "").trim();
  const ruleNumber = String(body.ruleNumber ?? definition.ruleNumber ?? "").trim();
  const title = String(body.title ?? definition.title ?? "").trim();
  const description = String(body.description ?? definition.description ?? "").trim();
  const category = String(body.category ?? definition.category ?? "").trim();
  const defaultSeverity = String(body.defaultSeverity ?? definition.defaultSeverity ?? "MEDIUM").trim();
  if (!ruleId || !ruleCode || !ruleNumber || !title || !description || !category) throw new Error("ruleId, ruleCode, ruleNumber, title, description and category are required.");
  const nextDefinition = { ...definition, ruleId, ruleCode, ruleNumber, ...(body.subclause !== undefined ? { subclause: body.subclause || undefined } : {}), title, description, category, defaultSeverity, enabled: body.enabled === undefined ? definition.enabled !== false : Boolean(body.enabled) };
  if (!Array.isArray(nextDefinition.versions) || nextDefinition.versions.length === 0) throw new Error("At least one rule version is required.");
  return { nextDefinition, ruleId, ruleCode, ruleNumber, title, description, category, defaultSeverity };
}

router.get("/overview", async (_req, res) => {
  try {
    const [users, admins, products, offlineProducts, ecommerceProducts, shops, inspections, categories, globalCategories, compliant, violations, review, recent, topCategory, inspectionStatuses, shopStats, brandStats, locationStats] = await Promise.all([
      prisma.user.count(), prisma.user.count({ where: { role: "ADMIN" } }), prisma.product.count(),
      prisma.product.count({ where: { sourceType: "OFFLINE" } }),
      prisma.product.count({ where: { sourceType: "ECOMMERCE" } }),
      prisma.shop.count(), prisma.inspection.count(), prisma.category.count(), prisma.category.count({ where: { isSystem: true } }),
      prisma.product.count({ where: { complianceStatus: "OKAY" } }), prisma.product.count({ where: { complianceStatus: "VIOLATION" } }), prisma.product.count({ where: { complianceStatus: { in: ["NEEDS_REVIEW", "UNABLE_TO_VERIFY"] } } }),
      prisma.inspection.findMany({ orderBy: { inspectedAt: "desc" }, take: 12, select: { id: true, status: true, inspectedAt: true, worker: { select: { name: true, email: true } }, shop: { select: { name: true } }, product: { select: { id: true, productName: true, brandName: true, complianceStatus: true, sourceType: true, sourceUrl: true, sourceWebsiteName: true, netQuantity: true, unit: true, mrp: true, barcode: true, category: { select: { id: true, name: true } } } } } }),
      prisma.product.groupBy({ by: ["categoryId"], _count: { _all: true }, orderBy: { _count: { categoryId: "desc" } }, take: 8 }),
      prisma.inspection.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.shop.findMany({ select: { id: true, name: true, city: true, state: true, _count: { select: { inspections: true } } } }),
      prisma.product.groupBy({ by: ["brandName"], where: { brandName: { not: null } }, _count: { _all: true }, orderBy: { _count: { brandName: "desc" } }, take: 8 }),
      prisma.shop.groupBy({ by: ["city", "state"], where: { city: { not: null } }, _count: { _all: true }, orderBy: { _count: { city: "desc" } }, take: 8 })
    ]);
    const categoryIds = topCategory.map((x) => x.categoryId);
    const topCategoryRows = categoryIds.length ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }) : [];
    const categoryNames = new Map(topCategoryRows.map((x) => [x.id, x.name]));
    const ruleCounts = {}; const brandViolations = {}; const locationViolations = {}; const monthlyViolations = {}; const repeatByShop = new Map();
    const violationProducts = await prisma.product.findMany({ where: { complianceStatus: "VIOLATION" }, select: { id: true, brandName: true, ocrData: true, sourceType: true, sourceWebsiteName: true, sourceUrl: true, inspections: { select: { shopId: true, inspectedAt: true, shop: { select: { name: true, city: true, state: true } } }, orderBy: { inspectedAt: "asc" } } }, take: 1000 });
    for (const product of violationProducts) {
      const history = product.inspections || []; const shopHistoryName = product.sourceType === "ECOMMERCE" ? (product.sourceWebsiteName || product.sourceUrl || "E-commerce source") : history[0]?.shop?.name;
      if (history.length > 1 && shopHistoryName) repeatByShop.set(shopHistoryName, (repeatByShop.get(shopHistoryName) || 0) + 1);
      const brand = product.brandName || "Unknown"; brandViolations[brand] = (brandViolations[brand] || 0) + 1;
      for (const inspection of history) {
        if (inspection.inspectedAt) { const key = inspection.inspectedAt.toISOString().slice(0, 7); monthlyViolations[key] = (monthlyViolations[key] || 0) + 1; }
        const loc = product.sourceType === "ECOMMERCE" ? (product.sourceWebsiteName || product.sourceUrl || "E-commerce source") : ([inspection.shop?.city, inspection.shop?.state].filter(Boolean).join(", ") || "Unknown");
        locationViolations[loc] = (locationViolations[loc] || 0) + 1;
      }
      try { const stored = product.ocrData ? JSON.parse(product.ocrData) : null; for (const finding of stored?.compliance?.findings || []) if (String(finding?.status).toUpperCase() === "VIOLATION") { const rule = finding.ruleNumber || finding.ruleCode || "Unknown"; ruleCounts[rule] = (ruleCounts[rule] || 0) + 1; } } catch {}
    }
    const repeatViolations = [...repeatByShop.entries()].map(([shop, count]) => ({ shop, repeatViolations: count })).sort((a, b) => b.repeatViolations - a.repeatViolations).slice(0, 8);
    res.json({
      counts: { users, admins, products, offlineProducts, ecommerceProducts, shops, inspections, categories, globalCategories, compliant, violations, review },
      recentInspections: recent.map((x) => ({ ...x, sourceType: x.product?.sourceType || "OFFLINE", sourceUrl: x.product?.sourceUrl || null, sourceWebsiteName: x.product?.sourceWebsiteName || null })),
      topCategories: topCategory.map((x) => ({ categoryId: x.categoryId, name: categoryNames.get(x.categoryId) || "Unknown", products: x._count._all })),
      topRules: Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([rule, count]) => ({ rule, count })),
      analytics: { inspectionStatuses: inspectionStatuses.map((x) => ({ status: x.status, count: x._count._all })), topBrands: brandStats.map((x) => ({ brand: x.brandName, products: x._count._all })), topLocations: locationStats.map((x) => ({ location: [x.city, x.state].filter(Boolean).join(", ") || "Unknown", inspections: x._count._all })), brandViolations: Object.entries(brandViolations).sort((a,b) => b[1]-a[1]).slice(0,8).map(([brand,count]) => ({ brand, violations: count })), locationViolations: Object.entries(locationViolations).sort((a,b) => b[1]-a[1]).slice(0,8).map(([location,count]) => ({ location, violations: count })), violationTrend: Object.entries(monthlyViolations).sort((a,b) => a[0].localeCompare(b[0])).slice(-12).map(([month,count]) => ({ month, violations: count })), repeatViolations, pendingVerification: review }
    });
  } catch (error) { console.error(error); res.status(500).json({ error: error?.message || "Failed to load admin overview" }); }
});
router.get("/rules", async (_req, res) => { try { res.json(await prisma.complianceRule.findMany({ orderBy: [{ enabled: "desc" }, { ruleCode: "asc" }] })); } catch (error) { console.error(error); res.status(500).json({ error: "Failed to load compliance rules" }); } });
router.post("/rules", async (req, res) => { try { const p = normalizeDefinition(req.body); const rule = await prisma.complianceRule.create({ data: { ruleId: p.ruleId, ruleCode: p.ruleCode, ruleNumber: p.ruleNumber, subclause: req.body.subclause || p.nextDefinition.subclause || null, title: p.title, description: p.description, category: p.category, defaultSeverity: p.defaultSeverity, enabled: p.nextDefinition.enabled, isBuiltin: false, definition: p.nextDefinition, createdById: req.user.id } }); res.status(201).json(rule); } catch (error) { console.error(error); res.status(400).json({ error: error?.message || "Failed to create rule" }); } });
router.put("/rules/:id", async (req, res) => { try { const existing = await prisma.complianceRule.findUnique({ where: { id: req.params.id } }); if (!existing) return res.status(404).json({ error: "Rule not found" }); const p = normalizeDefinition(req.body); const rule = await prisma.complianceRule.update({ where: { id: existing.id }, data: { ruleId: p.ruleId, ruleCode: p.ruleCode, ruleNumber: p.ruleNumber, subclause: req.body.subclause || p.nextDefinition.subclause || null, title: p.title, description: p.description, category: p.category, defaultSeverity: p.defaultSeverity, enabled: p.nextDefinition.enabled, definition: p.nextDefinition } }); res.json(rule); } catch (error) { console.error(error); res.status(400).json({ error: error?.message || "Failed to update rule" }); } });
router.delete("/rules/:id", async (req, res) => { try { const existing = await prisma.complianceRule.findUnique({ where: { id: req.params.id } }); if (!existing) return res.status(404).json({ error: "Rule not found" }); const rule = await prisma.complianceRule.update({ where: { id: existing.id }, data: { enabled: false, definition: { ...(existing.definition || {}), enabled: false } } }); res.json({ message: "Rule disabled. Historical inspections remain intact.", rule }); } catch (error) { console.error(error); res.status(500).json({ error: "Failed to disable rule" }); } });
export default router;
