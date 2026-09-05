import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

function scopeForUser(req) {
  return req.user.role === "ADMIN" ? {} : { workerId: req.user.id };
}

function sourceLabel(inspection) {
  if (String(inspection.product?.sourceType || "OFFLINE").toUpperCase() === "ECOMMERCE") {
    return inspection.product?.sourceWebsiteName || inspection.product?.sourceUrl || "E-commerce source";
  }
  return inspection.shop?.name || "Unknown shop";
}

router.get("/dashboard", async (req, res) => {
  try {
    const inspectionWhere = scopeForUser(req);
    const productWhere = req.user.role === "ADMIN" ? {} : { ownerId: req.user.id };

    const [inspectionCount, violationCount, reviewCount, recentInspections] = await Promise.all([
      prisma.inspection.count({ where: inspectionWhere }),
      prisma.inspection.count({ where: { ...inspectionWhere, status: "VIOLATION" } }),
      prisma.inspection.count({ where: { ...inspectionWhere, status: { in: ["NEEDS_REVIEW", "UNABLE_TO_VERIFY"] } } }),
      prisma.inspection.findMany({
        where: inspectionWhere,
        orderBy: { inspectedAt: "desc" },
        take: 5000,
        select: {
          status: true,
          inspectedAt: true,
          shop: { select: { name: true } },
          product: { select: { brandName: true, sourceType: true, sourceWebsiteName: true, sourceUrl: true, ocrData: true } },
        },
      }),
    ]);

    const monthly = new Map();
    const shopViolations = new Map();
    const brandViolations = new Map();
    const ruleViolations = new Map();

    for (const inspection of recentInspections) {
      const date = inspection.inspectedAt ? new Date(inspection.inspectedAt) : null;
      if (date && !Number.isNaN(date.getTime())) {
        const key = date.toISOString().slice(0, 7);
        monthly.set(key, (monthly.get(key) || 0) + 1);
      }

      if (inspection.status !== "VIOLATION") continue;

      const source = sourceLabel(inspection);
      shopViolations.set(source, (shopViolations.get(source) || 0) + 1);

      const brand = inspection.product?.brandName?.trim() || "Unknown brand";
      brandViolations.set(brand, (brandViolations.get(brand) || 0) + 1);

      try {
        const stored = inspection.product?.ocrData ? JSON.parse(inspection.product.ocrData) : null;
        for (const finding of stored?.compliance?.findings || []) {
          if (String(finding?.status || "").toUpperCase() !== "VIOLATION") continue;
          const rule = String(finding.ruleNumber || finding.ruleCode || finding.ruleId || "Unknown rule").trim();
          ruleViolations.set(rule, (ruleViolations.get(rule) || 0) + 1);
        }
      } catch {}
    }

    const now = new Date();
    const inspectionTrend = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const key = date.toISOString().slice(0, 7);
      inspectionTrend.push({ month: key, inspections: monthly.get(key) || 0 });
    }

    const topOf = (map, valueKey, limit = 1) => [...map.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, limit)
      .map(([label, count]) => ({ [valueKey]: label, count }));

    res.json({
      scope: req.user.role === "ADMIN" ? "PLATFORM" : "OWN",
      counts: { inspections: inspectionCount, violations: violationCount, review: reviewCount },
      inspectionTrend,
      highestViolatingShop: topOf(shopViolations, "name")[0] || null,
      highestViolatingBrand: topOf(brandViolations, "name")[0] || null,
      highestViolatingRule: topOf(ruleViolations, "name")[0] || null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load dashboard analytics" });
  }
});

export default router;
