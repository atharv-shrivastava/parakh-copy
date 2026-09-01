import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        parentId: null,
      },
      include: {
        children: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch categories",
    });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findFirst({
      where: {
        slug,
      },
      include: {
        children: true,
        products: true,
      },
    });

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch category",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, slug, parentId } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: "Name and slug are required",
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        parentId: parentId || null,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to create category",
    });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: {
        id,
      },
      include: {
        children: true,
        products: true,
      },
    });

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    if (category.children.length > 0) {
      return res.status(400).json({
        error: "Cannot delete a category that has subcategories",
      });
    }

    if (category.products.length > 0) {
      return res.status(400).json({
        error: "Cannot delete a category that contains products",
      });
    }

    await prisma.category.delete({
      where: {
        id,
      },
    });

    res.json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to delete category",
    });
  }
});

export default router;