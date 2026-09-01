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

export default router;