import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function getOrCreateCategory(name, slug, parentId = null) {
  if (parentId === null) {
    const existing = await prisma.category.findFirst({
      where: {
        parentId: null,
        slug,
      },
    });

    if (existing) {
      return prisma.category.update({
        where: {
          id: existing.id,
        },
        data: {
          name,
        },
      });
    }

    return prisma.category.create({
      data: {
        name,
        slug,
        parentId: null,
      },
    });
  }

  return prisma.category.upsert({
    where: {
      parentId_slug: {
        parentId,
        slug,
      },
    },
    update: {
      name,
    },
    create: {
      name,
      slug,
      parentId,
    },
  });
}

async function main() {
  const food = await getOrCreateCategory("Food", "food");

  await getOrCreateCategory(
    "Ready to Eat",
    "ready-to-eat",
    food.id
  );

  await getOrCreateCategory(
    "Ready to Cook",
    "ready-to-cook",
    food.id
  );

  await getOrCreateCategory(
    "Staples",
    "staples",
    food.id
  );

  await getOrCreateCategory(
    "Cooking Essentials",
    "cooking-essentials",
    food.id
  );

  await getOrCreateCategory(
    "Beverages",
    "beverages",
    food.id
  );

  await getOrCreateCategory(
    "Dairy",
    "dairy",
    food.id
  );

  await getOrCreateCategory(
    "Other Food",
    "other-food",
    food.id
  );

  console.log("PARAKH categories seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });