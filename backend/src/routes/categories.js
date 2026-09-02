import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function depthOf(category) {
  let depth = 1;
  let current = category;
  while (current?.parent) { depth += 1; current = current.parent; }
  return depth;
}

function buildTree(categories) {
  const byParent = new Map();
  for (const category of categories) {
    const key = category.parentId ?? "ROOT";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push({ ...category, children: [] });
  }
  const build = (parentId = "ROOT") => (byParent.get(parentId) ?? []).map((node) => ({ ...node, children: build(node.id) }));
  return build();
}

async function visibleCategoryWhere(userId, id) {
  return { id, OR: [{ isGlobal: true }, { ownerId: userId }] };
}

router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null, OR: [{ isGlobal: true }, { ownerId: req.user.id }] },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (error) { console.error(error); res.status(500).json({ error: "Failed to fetch categories" }); }
});

router.get("/tree/all", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ where: { OR: [{ isGlobal: true }, { ownerId: req.user.id }] }, orderBy: { name: "asc" } });
    res.json(buildTree(categories));
  } catch (error) { console.error(error); res.status(500).json({ error: "Failed to build category tree" }); }
});

router.get("/id/:id", async (req, res) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, OR: [{ isGlobal: true }, { ownerId: req.user.id }] },
      include: {
        parent: { include: { parent: { include: { parent: true } } } },
        children: { orderBy: { name: "asc" } },
        products: {
          where: { ownerId: req.user.id },
          include: { inspections: { include: { shop: true }, orderBy: { inspectedAt: "desc" }, take: 1 } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error) { console.error(error); res.status(500).json({ error: "Failed to fetch category" }); }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const parentId = req.body.parentId || null;
    const isFinal = Boolean(req.body.isFinal);
    const makeGlobal = Boolean(req.body.global);
    if (!name) return res.status(400).json({ error: "Category name is required" });
    if (makeGlobal && req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can create global categories" });

    let depth = 1;
    if (parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: parentId, OR: [{ isGlobal: true }, { ownerId: req.user.id }] },
        include: { parent: { include: { parent: { include: { parent: true } } } } },
      });
      if (!parent) return res.status(404).json({ error: "Parent category not found" });
      depth = depthOf(parent) + 1;
      if (depth > 4) return res.status(400).json({ error: "Maximum category hierarchy is four levels" });
      if (parent.isFinal) return res.status(400).json({ error: "Final categories cannot contain subcategories" });
    }

    const category = await prisma.category.create({
      data: { name, slug: slugify(req.body.slug || name), parentId, isFinal, isGlobal: makeGlobal, ownerId: makeGlobal ? null : req.user.id },
    });
    res.status(201).json(category);
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") return res.status(409).json({ error: "A category with this slug already exists at this level" });
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.patch("/:id/final", async (req, res) => {
  try {
    const category = await prisma.category.findFirst({ where: await visibleCategoryWhere(req.user.id, req.params.id), include: { children: true } });
    if (!category) return res.status(404).json({ error: "Category not found" });
    if (category.isGlobal && req.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can change global categories" });
    if (category.children.length) return res.status(400).json({ error: "A category with subcategories cannot be final" });
    res.json(await prisma.category.update({ where: { id: category.id }, data: { isFinal: true } }));
  } catch (error) { console.error(error); res.status(500).json({ error: "Failed to mark category final" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const category = await prisma.category.findFirst({ where: await visibleCategoryWhere(req.user.id, req.params.id), include: { children: true, products: true } });
    if (!category) return res.status(404).json({ error: "Category not found" });
    if (category.isGlobal && req.user.role !== "ADMIN") return res.status(403).json({ error: "Global categories cannot be deleted by users" });
    if (category.children.length || category.products.length) return res.status(400).json({ error: "Cannot delete a category containing subcategories or products" });
    await prisma.category.delete({ where: { id: category.id } });
    res.json({ message: "Category deleted successfully" });
  } catch (error) { console.error(error); res.status(500).json({ error: "Failed to delete category" }); }
});

export default router;
