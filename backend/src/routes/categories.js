import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/tree/all", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    const byParent = new Map();
    categories.forEach((category) => {
      const key = category.parentId ?? "ROOT";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push({ ...category, children: [] });
    });

    const build = (parentId = "ROOT") => (byParent.get(parentId) ?? []).map((category) => ({
      ...category,
      children: build(category.id),
    }));

    res.json(build());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to build category tree" });
  }
});

async function getCategory(idOrSlug, byId = false) {
  return prisma.category.findFirst({
    where: byId ? { id: idOrSlug } : { slug: idOrSlug },
    include: {
      parent: true,
      children: { orderBy: { name: "asc" } },
      products: {
        include: {
          inspections: {
            include: { shop: true },
            orderBy: { inspectedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

router.get("/id/:id", async (req, res) => {
  try {
    const category = await getCategory(req.params.id, true);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const category = await getCategory(req.params.slug);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, slug, parentId } = req.body;
    if (!name?.trim() || !slug?.trim()) return res.status(400).json({ error: "Name and slug are required" });

    if (parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) return res.status(404).json({ error: "Parent category not found" });
    }

    const category = await prisma.category.create({
      data: { name: name.trim(), slug: slug.trim().toLowerCase(), parentId: parentId || null },
    });
    res.status(201).json(category);
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") return res.status(409).json({ error: "A category with this name/slug already exists at this level" });
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { children: true, products: true },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });
    if (category.children.length > 0) return res.status(400).json({ error: "Cannot delete a category that has subcategories" });
    if (category.products.length > 0) return res.status(400).json({ error: "Cannot delete a category that contains products" });

    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
