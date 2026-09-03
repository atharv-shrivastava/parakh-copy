import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

const SOURCE_TYPES = new Set(["OFFLINE", "ECOMMERCE"]);
function normalizeSource(value) { const s = String(value || "OFFLINE").toUpperCase(); return SOURCE_TYPES.has(s) ? s : null; }
function slugify(v) { return String(v).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category"; }
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
  sourceType: true,
  createdAt: true,
  inspections: { select: { inspectedAt: true, shop: { select: { id: true, name: true } } }, orderBy: { inspectedAt: "desc" }, take: 1 },
};

router.get("/", async (req, res) => {
  try {
    const sourceType = req.query.sourceType ? normalizeSource(req.query.sourceType) : null;
    if (req.query.sourceType && !sourceType) return res.status(400).json({ error: "sourceType must be OFFLINE or ECOMMERCE" });
    const where = { parentId: null, OR: [{ isSystem: true }, { ownerId: req.user.id }], ...(sourceType ? { sourceType } : {}) };
    const x = await prisma.category.findMany({ where, include: { children: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } });
    res.json(x);
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to fetch categories" }); }
});

router.get("/tree/all", async (req, res) => {
  try {
    const sourceType = req.query.sourceType ? normalizeSource(req.query.sourceType) : null;
    if (req.query.sourceType && !sourceType) return res.status(400).json({ error: "sourceType must be OFFLINE or ECOMMERCE" });
    const x = await prisma.category.findMany({ where: { OR: [{ isSystem: true }, { ownerId: req.user.id }], ...(sourceType ? { sourceType } : {}) }, orderBy: { name: "asc" } });
    res.json(tree(x));
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to build category tree" }); }
});

router.get("/id/:id", async (req, res) => {
  try {
    const c = await prisma.category.findFirst({
      where: visible(req.user.id, req.params.id),
      select: {
        id: true, name: true, slug: true, parentId: true, isSystem: true, sourceType: true, ownerId: true, isFinalProductType: true, createdAt: true, updatedAt: true,
        parent: { select: { id: true, name: true, sourceType: true, isSystem: true, parent: { select: { id: true, name: true, sourceType: true, isSystem: true, parent: { select: { id: true, name: true, sourceType: true, isSystem: true } } } } } },
        children: { orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, parentId: true, isSystem: true, sourceType: true, ownerId: true, isFinalProductType: true } },
        products: { where: { ownerId: req.user.id }, select: categoryProductSelect, orderBy: { createdAt: "desc" }, take: 500 },
      },
    });
    if (!c) return res.status(404).json({ error: "Category not found" });
    res.json(c);
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to fetch category" }); }
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
    let sourceType = normalizeSource(req.body.sourceType) || "OFFLINE";
    let parent = null;
    if (parentId) {
      parent = await prisma.category.findFirst({ where: req.user.role === "ADMIN" ? { id: parentId } : visible(req.user.id, parentId), include: { parent: { include: { parent: { include: { parent: true } } } } } });
      if (!parent) return res.status(404).json({ error: "Parent category not found" });
      if (isSystem && !parent.isSystem) return res.status(400).json({ error: "Global categories can only be nested under global categories" });
      if (parent.isFinalProductType) return res.status(400).json({ error: "Final categories cannot contain subcategories" });
      if (parent.isSystem && !isSystem) sourceType = parent.sourceType;
      else if (parent.sourceType !== sourceType) return res.status(400).json({ error: "A category must use the same source type as its parent" });
      depth = depthOf(parent) + 1;
      if (depth > 4) return res.status(400).json({ error: "Maximum category hierarchy is four levels" });
    }

    const slugBase = slugify(req.body.slug || name);
    const slug = isSystem ? `${slugBase}-${sourceType.toLowerCase()}` : `${slugBase}-${req.user.id.slice(-8).toLowerCase()}`;
    const finalAtDepth = depth === 4 ? true : isFinal;
    const c = await prisma.category.create({ data: { name, slug, parentId, sourceType, isFinalProductType: finalAtDepth, isSystem, ownerId: isSystem ? null : req.user.id } });
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
    const nextFinal = req.body.isFinal === undefined ? true : Boolean(req.body.isFinal);
    if (nextFinal && c.children.length) return res.status(400).json({ error: "A category with subcategories cannot be final" });
    res.json(await prisma.category.update({ where: { id: c.id }, data: { isFinalProductType: nextFinal } }));
  } catch (e) { console.error(e); res.status(500).json({ error: "Failed to update category type" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";
    const root = await prisma.category.findFirst({ where: isAdmin ? { id: req.params.id } : visible(req.user.id, req.params.id) });
    if (!root) return res.status(404).json({ error: "Category not found" });
    if (root.isSystem && !isAdmin) return res.status(403).json({ error: "Global categories cannot be deleted by users" });

    const allCategories = await prisma.category.findMany({ where: isAdmin ? {} : { OR: [{ isSystem: true }, { ownerId: req.user.id }] }, select: { id: true, parentId: true, name: true, sourceType: true, isSystem: true, ownerId: true } });
    const byParent = new Map();
    for (const c of allCategories) { const key = c.parentId || "ROOT"; if (!byParent.has(key)) byParent.set(key, []); byParent.get(key).push(c); }
    const ids = [];
    const walk = (id) => { ids.push(id); for (const child of byParent.get(id) || []) walk(child.id); };
    walk(root.id);
    const productsInTree = await prisma.product.count({ where: { categoryId: { in: ids } } });

    const fallbackSlug = `uncategorized-${String(root.sourceType || "OFFLINE").toLowerCase()}`;
    const fallback = await prisma.category.findFirst({ where: { parentId: null, isSystem: true, sourceType: root.sourceType, slug: fallbackSlug } }) || await prisma.category.create({ data: { name: `Uncategorized (${root.sourceType === "ECOMMERCE" ? "E-commerce" : "Offline"})`, slug: fallbackSlug, sourceType: root.sourceType, isSystem: true, ownerId: null, isFinalProductType: true } });

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({ where: { categoryId: { in: ids } }, data: { categoryId: fallback.id } });
      for (const id of [...ids].reverse()) await tx.category.delete({ where: { id } });
    });
    res.json({ message: `Category deleted successfully. ${productsInTree} product(s) were moved to ${fallback.name}.` });
  } catch (e) { console.error(e); res.status(500).json({ error: e?.message || "Failed to delete category" }); }
});

export default router;
