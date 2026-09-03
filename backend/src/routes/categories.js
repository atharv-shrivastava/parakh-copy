import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

function slugify(v) {
  return String(v).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";
}

function depthOf(c) { let d = 1, p = c; while (p?.parent) { d++; p = p.parent; } return d; }
function tree(categories) { const map = new Map(); categories.forEach((c) => { const k = c.parentId || "ROOT"; if (!map.has(k)) map.set(k, []); map.get(k).push({ ...c, children: [] }); }); const build = (k = "ROOT") => (map.get(k) || []).map((c) => ({ ...c, children: build(c.id) })); return build(); }
const visible = (userId, id) => ({ id, OR: [{ isSystem: true }, { ownerId: userId }] });

const categoryProductSelect = {
  id: true,
  productName: true,
  brandName: true,
  netQuantity: true,
  unit: true,
  mrp: true,
  complianceStatus: true,
  createdAt: true,
  inspections: {
    select: {
      inspectedAt: true,
      shop: { select: { id: true, name: true } },
    },
    orderBy: { inspectedAt: "desc" },
    take: 1,
  },
};

router.get("/", async (req, res) => {
  try {
    const x = await prisma.category.findMany({ where: { parentId: null, OR: [{ isSystem: true }, { ownerId: req.user.id }] }, include: { children: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } });
    res.json(x);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/tree/all", async (req, res) => {
  try {
    const x = await prisma.category.findMany({ where: { OR: [{ isSystem: true }, { ownerId: req.user.id }] }, orderBy: { name: "asc" } });
    res.json(tree(x));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to build category tree" });
  }
});

router.get("/id/:id", async (req, res) => {
  try {
    const c = await prisma.category.findFirst({
      where: visible(req.user.id, req.params.id),
      select: {
        id: true, name: true, slug: true, parentId: true, isSystem: true, ownerId: true, isFinalProductType: true, createdAt: true, updatedAt: true,
        parent: { select: { id: true, name: true, parent: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } } } },
        children: { orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, parentId: true, isSystem: true, ownerId: true, isFinalProductType: true } },
        products: { where: { ownerId: req.user.id }, select: categoryProductSelect, orderBy: { createdAt: "desc" }, take: 500 },
      },
    });
    if (!c) return res.status(404).json({ error: "Category not found" });
    res.json(c);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const parentId = req.body.parentId || null;
    const isFinal = Boolean(req.body.isFinal);
    const isSystem = Boolean(req.body.global);
    if (!name) return res.status(400).json({ error: "Category name is required" });
    if (isSystem && req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can create global categories" });

    let depth = 1;
    if (parentId) {
      const p = await prisma.category.findFirst({ where: visible(req.user.id, parentId), include: { parent: { include: { parent: { include: { parent: true } } } } } });
      if (!p) return res.status(404).json({ error: "Parent category not found" });
      if (p.isSystem && req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can modify the global category tree" });
      if (p.isFinalProductType) return res.status(400).json({ error: "Final categories cannot contain subcategories" });
      depth = depthOf(p) + 1;
      if (depth > 4) return res.status(400).json({ error: "Maximum category hierarchy is four levels" });
    }

    const slugBase = slugify(req.body.slug || name);
    const slug = isSystem ? slugBase : `${slugBase}-${req.user.id.slice(-8).toLowerCase()}`;
    const finalAtDepth = depth === 4 ? true : isFinal;
    const c = await prisma.category.create({ data: { name, slug, parentId, isFinalProductType: finalAtDepth, isSystem, ownerId: isSystem ? null : req.user.id } });
    res.status(201).json(c);
  } catch (e) {
    console.error(e);
    if (e.code === "P2002") return res.status(409).json({ error: "A category with this name already exists for this account at this level" });
    res.status(500).json({ error: e?.message || "Failed to create category" });
  }
});

router.patch("/:id/final", async (req, res) => {
  try {
    const c = await prisma.category.findFirst({ where: visible(req.user.id, req.params.id), include: { children: true } });
    if (!c) return res.status(404).json({ error: "Category not found" });
    if (c.isSystem && req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can change global categories" });
    if (c.children.length) return res.status(400).json({ error: "A category with subcategories cannot be final" });
    res.json(await prisma.category.update({ where: { id: c.id }, data: { isFinalProductType: true } }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to mark category final" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const c = await prisma.category.findFirst({ where: visible(req.user.id, req.params.id), include: { children: true, products: true } });
    if (!c) return res.status(404).json({ error: "Category not found" });
    if (c.isSystem && req.user.role !== "ADMIN") return res.status(403).json({ error: "Global categories cannot be deleted by users" });
    if (c.children.length || c.products.length) return res.status(400).json({ error: "Cannot delete a category containing subcategories or products" });
    await prisma.category.delete({ where: { id: c.id } });
    res.json({ message: "Category deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
