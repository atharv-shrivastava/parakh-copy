-- Bring the checked-in Prisma schema to parity with existing PARAKH deployments.
-- Every change is idempotent so it is safe against an already-evolved database.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'USER';

ALTER TABLE "Shop"
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
  ADD COLUMN IF NOT EXISTS "isFinalProductType" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
  ADD COLUMN IF NOT EXISTS "ocrData" TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrls" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE INDEX IF NOT EXISTS "Category_ownerId_idx" ON "Category"("ownerId");
CREATE INDEX IF NOT EXISTS "Category_isSystem_idx" ON "Category"("isSystem");
CREATE INDEX IF NOT EXISTS "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX IF NOT EXISTS "Category_isFinalProductType_idx" ON "Category"("isFinalProductType");
CREATE INDEX IF NOT EXISTS "Product_ownerId_idx" ON "Product"("ownerId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session"
      ADD CONSTRAINT "Session_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shop_ownerId_fkey') THEN
    ALTER TABLE "Shop"
      ADD CONSTRAINT "Shop_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_ownerId_fkey') THEN
    ALTER TABLE "Category"
      ADD CONSTRAINT "Category_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_ownerId_fkey') THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
