-- Authentication and per-user ownership.
-- Existing categories are promoted to protected system categories so current
-- seeded categories remain available to every authenticated user.

ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT;

UPDATE "User"
SET "role" = 'USER'
WHERE "role" IS NULL OR "role" = 'WORKER';

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'USER';

ALTER TABLE "Category"
  ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ownerId" TEXT;

UPDATE "Category"
SET "isSystem" = true,
    "ownerId" = NULL;

ALTER TABLE "Product"
  ADD COLUMN "ownerId" TEXT NOT NULL;

ALTER TABLE "Shop"
  ADD COLUMN "ownerId" TEXT NOT NULL;

CREATE INDEX "Category_ownerId_idx" ON "Category"("ownerId");
CREATE INDEX "Category_isSystem_idx" ON "Category"("isSystem");
CREATE INDEX "Product_ownerId_idx" ON "Product"("ownerId");
CREATE INDEX "Shop_ownerId_idx" ON "Shop"("ownerId");

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shop"
  ADD CONSTRAINT "Shop_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
