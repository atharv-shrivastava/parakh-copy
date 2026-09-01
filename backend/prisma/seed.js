import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

async function getOrCreateCategory(name, slug, parentId = null) {
  if (parentId === null) {
    const existing = await prisma.category.findFirst({ where: { parentId: null, slug } });
    if (existing) return prisma.category.update({ where: { id: existing.id }, data: { name } });
    return prisma.category.create({ data: { name, slug, parentId: null } });
  }

  return prisma.category.upsert({
    where: { parentId_slug: { parentId, slug } },
    update: { name },
    create: { name, slug, parentId },
  });
}

async function main() {
  const food = await getOrCreateCategory("Food", "food");
  const utensils = await getOrCreateCategory("Utensils", "utensils");

  const readyToEat = await getOrCreateCategory("Ready to Eat", "ready-to-eat", food.id);
  const readyToCook = await getOrCreateCategory("Ready to Cook", "ready-to-cook", food.id);
  const staples = await getOrCreateCategory("Staples", "staples", food.id);
  const cookingEssentials = await getOrCreateCategory("Cooking Essentials", "cooking-essentials", food.id);
  const beverages = await getOrCreateCategory("Beverages", "beverages", food.id);
  const dairy = await getOrCreateCategory("Dairy", "dairy", food.id);
  await getOrCreateCategory("Other Food", "other-food", food.id);

  await getOrCreateCategory("Chips", "chips", readyToEat.id);
  await getOrCreateCategory("Biscuits", "biscuits", readyToEat.id);
  await getOrCreateCategory("Namkeen", "namkeen", readyToEat.id);

  await getOrCreateCategory("McCain", "mccain", readyToCook.id);
  await getOrCreateCategory("Instant Mixes", "instant-mixes", readyToCook.id);
  await getOrCreateCategory("Frozen Snacks", "frozen-snacks", readyToCook.id);

  await getOrCreateCategory("Cookware", "cookware", utensils.id);
  await getOrCreateCategory("Storage", "storage", utensils.id);
  await getOrCreateCategory("Kitchen Tools", "kitchen-tools", utensils.id);

  await getOrCreateCategory("Rice & Grains", "rice-grains", staples.id);
  await getOrCreateCategory("Spices", "spices", cookingEssentials.id);
  await getOrCreateCategory("Oil", "oil", cookingEssentials.id);
  await getOrCreateCategory("Soft Drinks", "soft-drinks", beverages.id);
  await getOrCreateCategory("Milk", "milk", dairy.id);

  console.log("PARAKH categories seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
