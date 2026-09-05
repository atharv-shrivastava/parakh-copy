import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

function visible(req) { return req.user.role === "ADMIN" ? {} : { ownerId: req.user.id }; }

router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "ALL");
    const sourceType = String(req.query.sourceType || "ALL").toUpperCase();
    const shops = await prisma.shop.findMany({
      where: {
        ...visible(req),
        ...(sourceType !== "ALL" ? { sourceType: sourceType === "ECOMMERCE" ? "ECOMMERCE" : "OFFLINE" } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } }] } : {}),
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        sourceType: true,
        inspections: {
          select: { productId: true, status: true, inspectedAt: true },
          orderBy: { inspectedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });
    const data = shops.map((shop) => {
      const products = new Set(shop.inspections.map((i) => i.productId));
      const statuses = shop.inspections.map((i) => i.status);
      const computedStatus = statuses.includes("VIOLATION") ? "NON_COMPLIANT" : statuses.includes("NEEDS_REVIEW") || statuses.includes("UNABLE_TO_VERIFY") ? "REVIEW" : "COMPLIANT";
      return { id: shop.id, name: shop.name, address: shop.address, city: shop.city, state: shop.state, sourceType: shop.sourceType || "OFFLINE", productCount: products.size, inspectionCount: shop.inspections.length, lastInspection: shop.inspections[0]?.inspectedAt || null, status: computedStatus };
    });
    res.json(status === "ALL" ? data : data.filter((x) => x.status === status));
  } catch (error) { console.error(error); res.status(500).json({ error: error?.message || "Failed to fetch shops" }); }
});

router.get("/:id", async (req, res) => {
  try {
    const shop = await prisma.shop.findFirst({ where: { id: req.params.id, ...visible(req) }, include: { inspections: { include: { product: { include: { category: true } }, worker: { select: { id: true, name: true } } }, orderBy: { inspectedAt: "desc" } } } });
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    const uniqueProducts = [...new Map(shop.inspections.map((i) => [i.productId, i.product])).values()];
    res.json({ ...shop, products: uniqueProducts, productCount: uniqueProducts.length, inspectionCount: shop.inspections.length, lastInspection: shop.inspections[0]?.inspectedAt || null });
  } catch (error) { console.error(error); res.status(500).json({ error: error?.message || "Failed to fetch shop" }); }
});

router.get("/:id/products", async (req, res) => {
  try {
    const shop = await prisma.shop.findFirst({ where: { id: req.params.id, ...visible(req) } });
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    const inspections = await prisma.inspection.findMany({ where: { shopId: shop.id, ...(req.user.role === "ADMIN" ? {} : { workerId: req.user.id }) }, include: { product: { include: { category: { include: { parent: { include: { parent: { include: { parent: true } } } } } }, owner: { select: { name: true } } } }, worker: { select: { name: true } } }, orderBy: { inspectedAt: "desc" } });
    res.json(inspections.map((i) => ({ ...i.product, inspection: i })));
  } catch (error) { console.error(error); res.status(500).json({ error: error?.message || "Failed to fetch shop products" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const shop = await prisma.shop.findFirst({ where: { id: req.params.id, ...visible(req) }, select: { id: true, name: true, sourceType: true } });
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    await prisma.$transaction(async (tx) => {
      await tx.inspection.deleteMany({ where: { shopId: shop.id } });
      await tx.shop.delete({ where: { id: shop.id } });
    });
    res.json({ success: true, deletedShop: shop });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || "Failed to delete shop" });
  }
});

export default router;
