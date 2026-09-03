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
    const [users, admins, products, shops, inspections, categories, globalCategories, compliant, violations, review, recent, topCategory] = await Promise.all([
      prisma.user.count(), prisma.user.count({ where: { role: "ADMIN" } }), prisma.product.count(), prisma.shop.count(), prisma.inspection.count(), prisma.category.count(),
      prisma.category.count({ where: { isSystem: true } }), prisma.product.count({ where: { complianceStatus: "OKAY" } }), prisma.product.count({ where: { complianceStatus: "VIOLATION" } }),
      prisma.product.count({ where: { complianceStatus: { in: ["NEEDS_REVIEW", "UNABLE_TO_VERIFY"] } } }),
      prisma.inspection.findMany({ orderBy: { inspectedAt: "desc" }, take: 8, select: { id: true, status: true, inspectedAt: true, worker: { select: { name: true, email: true } }, shop: { select: { name: true } }, product: { select: { id: true, productName: true, brandName: true, complianceStatus: true } } } }),
      prisma.product.groupBy({ by: ["categoryId"], _count: { _all: true }, orderBy: { _count: { categoryId: "desc" } }, take: 6 }),
    ]);
    const categoryIds = topCategory.map((x) => x.categoryId);
    const topCategoryRows = categoryIds.length ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }) : [];
    const categoryNames = new Map(topCategoryRows.map((x) => [x.id, x.name]));
    const ruleCounts = {};
    for (const product of await prisma.product.findMany({ where: { complianceStatus: "VIOLATION" }, select: { ocrData: true }, take: 500 })) {
      try { const stored = product.ocrData ? JSON.parse(product.ocrData) : null; for (const finding of stored?.compliance?.findings || []) if (String(finding?.status).toUpperCase() === "VIOLATION") ruleCounts[finding.ruleNumber || "Unknown"] = (ruleCounts[finding.ruleNumber || "Unknown"] || 0) + 1; } catch {}
    }
    res.json({ counts: { users, admins, products, shops, inspections, categories, globalCategories, compliant, violations, review }, recentInspections: recent, topCategories: topCategory.map((x) => ({ categoryId: x.categoryId, name: categoryNames.get(x.categoryId) || "Unknown", products: x._count._all })), topRules: Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([rule, count]) => ({ rule, count })) });
  } catch (error) { console.error(error); res.status(500).json({ error: error?.message || "Failed to load admin overview" }); }
});

router.get("/rules", async (_req, res) => {
  try { res.json(await prisma.complianceRule.findMany({ orderBy: [{ enabled: "desc" }, { ruleCode: "asc" }] })); }
  catch (error) { console.error(error); res.status(500).json({ error: "Failed to load compliance rules" }); }
});

router.post("/rules", async (req, res) => {
  try {
    const p = normalizeDefinition(req.body);
    const rule = await prisma.complianceRule.create({ data: { ruleId: p.ruleId, ruleCode: p.ruleCode, ruleNumber: p.ruleNumber, subclause: req.body.subclause || p.nextDefinition.subclause || null, title: p.title, description: p.description, category: p.category, defaultSeverity: p.defaultSeverity, enabled: p.nextDefinition.enabled, isBuiltin: false, definition: p.nextDefinition, createdById: req.user.id } });
    res.status(201).json(rule);
  } catch (error) { console.error(error); res.status(400).json({ error: error?.message || "Failed to create rule" }); }
});

router.put("/rules/:id", async (req, res) => {
  try {
    const existing = await prisma.complianceRule.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Rule not found" });
    const p = normalizeDefinition(req.body);
    const rule = await prisma.complianceRule.update({ where: { id: existing.id }, data: { ruleId: p.ruleId, ruleCode: p.ruleCode, ruleNumber: p.ruleNumber, subclause: req.body.subclause || p.nextDefinition.subclause || null, title: p.title, description: p.description, category: p.category, defaultSeverity: p.defaultSeverity, enabled: p.nextDefinition.enabled, definition: p.nextDefinition } });
    res.json(rule);
  } catch (error) { console.error(error); res.status(400).json({ error: error?.message || "Failed to update rule" }); }
});

router.delete("/rules/:id", async (req, res) => {
  try {
    const existing = await prisma.complianceRule.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Rule not found" });
    const rule = await prisma.complianceRule.update({ where: { id: existing.id }, data: { enabled: false, definition: { ...(existing.definition || {}), enabled: false } } });
    res.json({ message: "Rule disabled. Historical inspections remain intact.", rule });
  } catch (error) { console.error(error); res.status(500).json({ error: "Failed to disable rule" }); }
});

export default router;
