import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/overview", async (_req, res) => {
  try {
    const [users, admins, products, shops, inspections, categories, globalCategories, compliant, violations, review, recent, topCategory] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.product.count(),
      prisma.shop.count(),
      prisma.inspection.count(),
      prisma.category.count(),
      prisma.category.count({ where: { isSystem: true } }),
      prisma.product.count({ where: { complianceStatus: "OKAY" } }),
      prisma.product.count({ where: { complianceStatus: "VIOLATION" } }),
      prisma.product.count({ where: { complianceStatus: { in: ["NEEDS_REVIEW", "UNABLE_TO_VERIFY"] } } }),
      prisma.inspection.findMany({
        orderBy: { inspectedAt: "desc" },
        take: 8,
        select: {
          id: true, status: true, inspectedAt: true,
          worker: { select: { name: true, email: true } },
          shop: { select: { name: true } },
          product: { select: { id: true, productName: true, brandName: true, complianceStatus: true } },
        },
      }),
      prisma.product.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
        orderBy: { _count: { categoryId: "desc" } },
        take: 6,
      }),
    ]);

    const categoryIds = topCategory.map((x) => x.categoryId);
    const topCategoryRows = categoryIds.length
      ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : [];
    const categoryNames = new Map(topCategoryRows.map((x) => [x.id, x.name]));

    const ruleCounts = {};
    for (const product of await prisma.product.findMany({ where: { complianceStatus: "VIOLATION" }, select: { ocrData: true }, take: 500 })) {
      try {
        const stored = product.ocrData ? JSON.parse(product.ocrData) : null;
        for (const finding of stored?.compliance?.findings || []) {
          if (String(finding?.status).toUpperCase() === "VIOLATION") {
            const key = finding.ruleNumber || "Unknown";
            ruleCounts[key] = (ruleCounts[key] || 0) + 1;
          }
        }
      } catch {}
    }

    res.json({
      counts: {
        users, admins, products, shops, inspections, categories, globalCategories,
        compliant, violations, review,
      },
      recentInspections: recent,
      topCategories: topCategory.map((x) => ({ categoryId: x.categoryId, name: categoryNames.get(x.categoryId) || "Unknown", products: x._count._all })),
      topRules: Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([rule, count]) => ({ rule, count })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || "Failed to load admin overview" });
  }
});

export default router;
