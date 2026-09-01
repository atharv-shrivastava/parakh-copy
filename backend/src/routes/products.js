import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

function verifyProduct({ brandName, productName, netQuantity, unit, mrp }) {
  const missing = [];

  if (!brandName?.trim()) missing.push("manufacturer/brand information");
  if (!productName?.trim()) missing.push("product name");
  if (!netQuantity?.trim()) missing.push("net quantity");
  if (!unit?.trim()) missing.push("quantity unit");
  if (mrp === undefined || mrp === null || Number.isNaN(Number(mrp))) {
    missing.push("MRP");
  }

  if (missing.length > 0) {
    return {
      status: "VIOLATION",
      reason: `Missing declaration(s) requiring inspection: ${missing.join(", ")}.`,
    };
  }

  return {
    status: "OKAY",
    reason: "Basic automated packaged-commodity declaration screening passed. Final legal verification remains with the inspector.",
  };
}

router.get("/", async (req, res) => {
  try {
    const {
      categoryId,
      status,
      brandName,
      productName,
      unit,
      minQuantity,
      maxQuantity,
      shopName,
    } = req.query;

    const where = {
      ...(categoryId ? { categoryId } : {}),
      ...(status && status !== "ALL" ? { complianceStatus: status } : {}),
      ...(brandName ? { brandName: { contains: brandName, mode: "insensitive" } } : {}),
      ...(productName ? { productName: { contains: productName, mode: "insensitive" } } : {}),
      ...(unit ? { unit } : {}),
      ...(minQuantity || maxQuantity
        ? {
            netQuantity: {
              not: null,
            },
          }
        : {}),
      ...(shopName
        ? {
            inspections: {
              some: {
                shop: {
                  name: { contains: shopName, mode: "insensitive" },
                },
              },
            },
          }
        : {}),
    };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        inspections: {
          include: { shop: true },
          orderBy: { inspectedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filtered = products.filter((product) => {
      const quantity = Number.parseFloat(product.netQuantity ?? "");
      if (minQuantity && (!Number.isFinite(quantity) || quantity < Number(minQuantity))) return false;
      if (maxQuantity && (!Number.isFinite(quantity) || quantity > Number(maxQuantity))) return false;
      return true;
    });

    res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: { include: { parent: true } },
        inspections: { include: { shop: true }, orderBy: { inspectedAt: "desc" } },
      },
    });

    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      categoryId,
      brandName,
      productName,
      description,
      netQuantity,
      unit,
      mrp,
      barcode,
      imageUrl,
    } = req.body;

    if (!categoryId || !productName?.trim()) {
      return res.status(400).json({ error: "Category and product name are required" });
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(404).json({ error: "Product type not found" });

    const children = await prisma.category.count({ where: { parentId: categoryId } });
    if (children > 0) {
      return res.status(400).json({ error: "Select the final product type before registering a product" });
    }

    const verification = verifyProduct({ brandName, productName, netQuantity, unit, mrp });

    const product = await prisma.product.create({
      data: {
        categoryId,
        brandName: brandName?.trim() || null,
        productName: productName.trim(),
        description: description?.trim() || null,
        netQuantity: netQuantity?.trim() || null,
        unit: unit?.trim() || null,
        mrp: mrp === "" || mrp === undefined ? null : Number(mrp),
        barcode: barcode?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        complianceStatus: verification.status,
        violationReason: verification.reason,
      },
      include: { category: true },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to register product" });
  }
});

export default router;
